package main

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
)

// getNextAmpCacheDir returns the OS-specific cache directory for NextAmp
func getNextAmpCacheDir() string {
	switch runtime.GOOS {
	case "windows":
		if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
			return filepath.Join(localAppData, "NextAmp")
		}
		return filepath.Join(os.TempDir(), "NextAmp")
	case "darwin":
		if home := os.Getenv("HOME"); home != "" {
			return filepath.Join(home, "Library", "Caches", "NextAmp")
		}
		return filepath.Join(os.TempDir(), "NextAmp")
	default:
		if xdgCache := os.Getenv("XDG_CACHE_HOME"); xdgCache != "" {
			return filepath.Join(xdgCache, "NextAmp")
		}
		if home := os.Getenv("HOME"); home != "" {
			return filepath.Join(home, ".cache", "NextAmp")
		}
		return filepath.Join(os.TempDir(), "NextAmp")
	}
}

// findOrExtractLibrary locates ONNX Runtime library or unpacks embedded copy if needed
func findOrExtractLibrary() (string, error) {
	execPath, err := os.Executable()
	var execDir string
	if err == nil {
		execDir = filepath.Dir(execPath)
	}

	// 1. Check current directory and executable directory
	localCandidates := []string{
		embeddedRuntimeName,
		filepath.Join(execDir, embeddedRuntimeName),
	}

	// 2. Add standard system library search paths
	if runtime.GOOS == "darwin" {
		localCandidates = append(localCandidates,
			"/usr/local/lib/libonnxruntime.dylib",
			"/opt/homebrew/lib/libonnxruntime.dylib",
		)
	} else if runtime.GOOS == "linux" {
		localCandidates = append(localCandidates,
			"/usr/lib/libonnxruntime.so",
			"/usr/local/lib/libonnxruntime.so",
		)
	}

	for _, p := range localCandidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() && fi.Size() > 1024*1024 {
			return p, nil
		}
	}

	// 3. Check cached extracted library in user's cache dir
	cacheDir := getNextAmpCacheDir()
	cachedLibPath := filepath.Join(cacheDir, embeddedRuntimeName)

	if fi, err := os.Stat(cachedLibPath); err == nil && !fi.IsDir() {
		// If size matches or looks like a complete library, reuse it immediately
		if embeddedRuntimeSize == 0 || fi.Size() == embeddedRuntimeSize || fi.Size() > 1024*1024 {
			return cachedLibPath, nil
		}
	}

	// 4. Extract embedded compressed library if present
	if len(embeddedRuntimeLib) > 0 {
		if err := os.MkdirAll(cacheDir, 0755); err != nil {
			return "", fmt.Errorf("failed to create cache dir %s: %w", cacheDir, err)
		}

		gzReader, err := gzip.NewReader(bytes.NewReader(embeddedRuntimeLib))
		if err != nil {
			return "", fmt.Errorf("failed to open embedded library gzip: %w", err)
		}
		defer gzReader.Close()

		// Write to temporary file first, then atomically rename
		tmpPath := cachedLibPath + ".tmp"
		f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
		if err != nil {
			return "", fmt.Errorf("failed to create file %s: %w", tmpPath, err)
		}

		_, err = io.Copy(f, gzReader)
		f.Close()
		if err != nil {
			os.Remove(tmpPath)
			return "", fmt.Errorf("failed to extract embedded library: %w", err)
		}

		if err := os.Rename(tmpPath, cachedLibPath); err != nil {
			// On Windows rename may fail if file is open, check if target exists
			if _, statErr := os.Stat(cachedLibPath); statErr != nil {
				return "", fmt.Errorf("failed to move extracted library to %s: %w", cachedLibPath, err)
			}
		}

		// Ensure permissions
		os.Chmod(cachedLibPath, 0755)

		return cachedLibPath, nil
	}

	return embeddedRuntimeName, fmt.Errorf("ONNX Runtime library not found and no embedded library available")
}

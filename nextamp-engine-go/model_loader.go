package main

import (
	"bytes"
	"compress/gzip"
	"crypto/aes"
	"crypto/cipher"
	_ "embed"
	"fmt"
	"io"
	"os"
)

//go:embed assets/model.enc
var embeddedEncryptedModel []byte

// loadDecryptedModel loads, decrypts, and decompresses the AI model purely in memory.
// The raw ONNX graph and weights never touch disk.
func loadDecryptedModel() ([]byte, error) {
	// If explicit dev flag is set, allow loading from file
	if os.Getenv("NEXTAMP_USE_LOCAL_MODEL") == "1" {
		if data, err := os.ReadFile("model.onnx"); err == nil {
			return data, nil
		}
	}

	if len(embeddedEncryptedModel) < 12+16 {
		return nil, fmt.Errorf("embedded model data is missing or corrupted (size: %d)", len(embeddedEncryptedModel))
	}

	key := getModelKey()
	defer func() {
		for i := range key {
			key[i] = 0
		}
	}()

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("cipher initialization error: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("GCM initialization error: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(embeddedEncryptedModel) < nonceSize {
		return nil, fmt.Errorf("invalid ciphertext format")
	}

	nonce := embeddedEncryptedModel[:nonceSize]
	ciphertext := embeddedEncryptedModel[nonceSize:]

	compressed, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("model decryption failed (tampered or invalid key): %w", err)
	}

	gzReader, err := gzip.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return nil, fmt.Errorf("model decompression init failed: %w", err)
	}
	defer gzReader.Close()

	decompressed, err := io.ReadAll(gzReader)
	if err != nil {
		return nil, fmt.Errorf("model decompression failed: %w", err)
	}

	return decompressed, nil
}

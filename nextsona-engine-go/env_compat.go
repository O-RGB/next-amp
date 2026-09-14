package main

import "os"

// compatEnv returns the rebranded environment variable first and falls back
// to the legacy name for local development scripts from the previous release.
// The fallback can be removed after the NextSona migration window closes.
func compatEnv(currentName, legacyName string) string {
	if value := os.Getenv(currentName); value != "" {
		return value
	}
	return os.Getenv(legacyName)
}

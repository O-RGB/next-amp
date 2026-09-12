//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

var (
	kernel32                       = syscall.NewLazyDLL("kernel32.dll")
	procGetConsoleMode             = kernel32.NewProc("GetConsoleMode")
	procSetConsoleMode             = kernel32.NewProc("SetConsoleMode")
	procGetStdHandle               = kernel32.NewProc("GetStdHandle")
)

const (
	stdOutputHandle                  = uint32(0xFFFFFFF5) // -11
	enableVirtualTerminalProcessing = uint32(0x0004)
)

func initConsole() {
	handle, _, _ := procGetStdHandle.Call(uintptr(stdOutputHandle))
	if handle == 0 || handle == uintptr(syscall.InvalidHandle) {
		return
	}

	var mode uint32
	ret, _, _ := procGetConsoleMode.Call(handle, uintptr(unsafe.Pointer(&mode)))
	if ret != 0 {
		procSetConsoleMode.Call(handle, uintptr(mode|enableVirtualTerminalProcessing))
	}
}

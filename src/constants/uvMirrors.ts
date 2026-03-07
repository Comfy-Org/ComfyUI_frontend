interface UVMirror {
  settingId: string
  mirror: string
  fallbackMirror: string
  validationPathSuffix?: string
}

export const PYTHON_MIRROR: UVMirror = {
  settingId: 'Comfy-Desktop.UV.PythonInstallMirror',
  mirror:
    'https://github.com/astral-sh/python-build-standalone/releases/download',
  fallbackMirror:
    'https://python-standalone.org/mirror/astral-sh/python-build-standalone',
  validationPathSuffix:
    '/20250115/cpython-3.10.16+20250115-aarch64-apple-darwin-debug-full.tar.zst.sha256'
}

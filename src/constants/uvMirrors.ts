export interface UVMirror {
  /**
   * The setting id defined for the mirror.
   */
  settingId: string
  /**
   * The default mirror to use.
   */
  mirror: string
  /**
   * The fallback mirror to use.
   */
  fallbackMirror: string
  /**
   * The path suffix to validate the mirror is reachable.
   */
  validationPathSuffix?: string
}

export const PYTHON_MIRROR: UVMirror = {
  settingId: 'Comfy-Desktop.UV.PythonInstallMirror',
  mirror:
    'https://github.com/astral-sh/python-build-standalone/releases/download',
  fallbackMirror:
    'https://ghfast.top/https://github.com/astral-sh/python-build-standalone/releases/download',
  validationPathSuffix:
    '/cpython-3.12.4%2B20240713-aarch64-apple-darwin-install_only.tar.gz'
}

export const PYPI_MIRROR: UVMirror = {
  settingId: 'Comfy-Desktop.UV.PypiInstallMirror',
  mirror: 'https://pypi.org/simple/',
  fallbackMirror: 'https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple'
}

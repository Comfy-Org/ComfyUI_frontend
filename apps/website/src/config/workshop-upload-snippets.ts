import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'

export function uploadSnippet(language: 'python' | 'typescript'): string[] {
  const endpoint = JSON.stringify(
    `${WORKSHOP_ROUTER_BASE_URL}/customers/storage`
  )
  if (language === 'python')
    return [
      'from uuid import uuid4',
      'from urllib.parse import urlsplit',
      '',
      'def storage_url(value):',
      '    url = urlsplit(value)',
      '    if url.scheme != "https" or not url.hostname or url.username or url.password:',
      '        raise ValueError("Invalid storage URL")',
      '    return value',
      '',
      'def upload_file(path, content_type):',
      '    source = Path(path)',
      `    grant = requests.post(${endpoint},`,
      '        headers={"Authorization": "Bearer " + os.environ["COMFY_API_KEY"]},',
      '        json={"file_name": str(uuid4()) + "-" + source.name, "content_type": content_type},',
      '        timeout=120, allow_redirects=False)',
      '    if not 200 <= grant.status_code < 300:',
      '        raise RuntimeError("Upload authorization failed")',
      '    urls = grant.json()',
      '    upload_url = storage_url(urls["upload_url"])',
      '    download_url = storage_url(urls["download_url"])',
      '    with source.open("rb") as data:',
      '        uploaded = requests.put(upload_url, data=data,',
      '            headers={"Content-Type": content_type}, timeout=120, allow_redirects=False)',
      '    if not 200 <= uploaded.status_code < 300:',
      '        raise RuntimeError("Upload failed")',
      '    return download_url',
      ''
    ]
  return [
    'function storageUrl(value: unknown): string {',
    '  if (typeof value !== "string") throw new Error("Invalid storage URL")',
    '  const url = new URL(value)',
    '  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid storage URL")',
    '  return value',
    '}',
    '',
    'async function uploadFile(path: string, contentType: string): Promise<string> {',
    '  const data = await readFile(path)',
    `  const grant = await fetch(${endpoint}, {`,
    '    method: "POST", redirect: "error", credentials: "omit",',
    '    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },',
    '    body: JSON.stringify({ file_name: `${crypto.randomUUID()}-${path.split(/[\\\\/]/).at(-1)}`, content_type: contentType }),',
    '    signal: AbortSignal.timeout(120_000)',
    '  })',
    '  if (!grant.ok) throw new Error("Upload authorization failed")',
    '  const urls: unknown = await grant.json()',
    '  if (!urls || typeof urls !== "object" || !("upload_url" in urls) || !("download_url" in urls)) throw new Error("Invalid upload response")',
    '  const uploadUrl = storageUrl(urls.upload_url)',
    '  const downloadUrl = storageUrl(urls.download_url)',
    '  const uploaded = await fetch(uploadUrl, {',
    '    method: "PUT", redirect: "error", credentials: "omit",',
    '    headers: { "Content-Type": contentType }, body: data,',
    '    signal: AbortSignal.timeout(120_000)',
    '  })',
    '  if (!uploaded.ok) throw new Error("Upload failed")',
    '  return downloadUrl',
    '}',
    ''
  ]
}

async function sendSmtp({ host, port, username, password, from, fromName, to, subject, html }) {
  const { connect } = await import('cloudflare:sockets')

  const portStr = String(port)
  const useTls = portStr === '465'
  const useStartTls = portStr === '587'

  function b64(str) {
    const bytes = new TextEncoder().encode(str)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  function createEmailContent(from, fromName, to, subject, html) {
    const boundary = '----=_Part_' + Date.now()
    const lines = []
    lines.push(`From: =?UTF-8?B?${b64(fromName)}?= <${from}>`)
    lines.push(`To: <${to}>`)
    lines.push(`Subject: =?UTF-8?B?${b64(subject)}?=`)
    lines.push('MIME-Version: 1.0')
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    let b64Html = b64(html)
    const chunks = []
    for (let i = 0; i < b64Html.length; i += 76) {
      chunks.push(b64Html.substring(i, i + 76))
    }
    lines.push(chunks.join('\r\n'))
    lines.push('')
    lines.push(`--${boundary}--`)
    return lines.join('\r\n')
  }

  const secureTransport = useTls ? 'on' : (useStartTls ? 'starttls' : 'off')
  const socket = connect({ hostname: host, port: parseInt(portStr) }, { secureTransport })
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  let currentWriter = socket.writable.getWriter()
  let currentReader = socket.readable.getReader()
  let buffer = ''

  async function readResponse() {
    while (true) {
      if (buffer.includes('\r\n')) {
        const lines = buffer.split('\r\n')
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i]
          if (line.length >= 4 && line[3] === ' ') {
            const code = parseInt(line.substring(0, 3))
            const msg = line.substring(4)
            buffer = lines.slice(i + 1).join('\r\n')
            return { code, msg, line }
          }
        }
      }
      const { value, done } = await currentReader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
    }
    const lastLine = buffer.trimEnd()
    buffer = ''
    const code = parseInt(lastLine.substring(0, 3))
    return { code, msg: lastLine.substring(4), line: lastLine }
  }

  async function send(cmd) {
    await currentWriter.write(encoder.encode(cmd + '\r\n'))
  }

  async function sendRaw(data) {
    await currentWriter.write(data)
  }

  async function expect(code) {
    const resp = await readResponse()
    if (resp.code !== code) {
      throw new Error(`SMTP error: expected ${code}, got ${resp.code} - ${resp.line}`)
    }
    return resp
  }

  async function upgradeToTls() {
    const secureSocket = socket.startTls()
    currentWriter.releaseLock()
    currentReader.releaseLock()
    currentWriter = secureSocket.writable.getWriter()
    currentReader = secureSocket.readable.getReader()
    buffer = ''
  }

  async function quit() {
    try { await send('QUIT'); await readResponse() } catch {}
    try { currentWriter.releaseLock(); currentReader.releaseLock() } catch {}
  }

  try {
    await expect(220)
    await send(`EHLO ${host}`)
    await expect(250)

    if (useStartTls) {
      await send('STARTTLS')
      await expect(220)
      await upgradeToTls()
      await send(`EHLO ${host}`)
      await expect(250)
    }

    await send('AUTH LOGIN')
    await expect(334)
    await send(b64(username))
    await expect(334)
    await send(b64(password))
    const authResp = await readResponse()
    if (authResp.code !== 235) {
      throw new Error(`SMTP auth failed: ${authResp.code} ${authResp.line}`)
    }

    await send(`MAIL FROM:<${from}>`)
    await expect(250)
    await send(`RCPT TO:<${to}>`)
    await expect(250)
    await send('DATA')
    await expect(354)
    const emailContent = createEmailContent(from, fromName, to, subject, html)
    await sendRaw(encoder.encode(emailContent + '\r\n.\r\n'))
    await expect(250)
    await quit()
    return { success: true }
  } catch (err) {
    try { await quit() } catch {}
    throw err
  }
}

export { sendSmtp }

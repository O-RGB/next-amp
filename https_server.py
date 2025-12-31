from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

PORT = 8449

httpd = HTTPServer(("0.0.0.0", PORT), SimpleHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile="cert.pem", keyfile="key.pem")

httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"HTTPS running at https://localhost:{PORT}")
httpd.serve_forever()

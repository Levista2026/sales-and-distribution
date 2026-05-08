const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const port = 5500;

const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

http
  .createServer((req, res) => {
    let requestPath = decodeURIComponent(req.url.split("?")[0]);
    if (requestPath === "/") requestPath = "/index.html";

    const filePath = path.join(root, requestPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`Serving ${root} on http://localhost:${port}`);
  });

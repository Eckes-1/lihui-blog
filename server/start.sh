#!/bin/bash

LIHUI_BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/lihui-blog/nodejs"
SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[LiHui] 正在启动 lihui-blog 评论系统..."
cd "$LIHUI_BACKEND_DIR"
node dist/app.js &
LIHUI_PID=$!
echo "[LiHui] lihui-blog 已启动 (PID: $LIHUI_PID, 端口: 3002)"

sleep 2

echo "[LiHui] 正在启动博客服务器..."
cd "$SERVER_DIR"
node index.js &
SERVER_PID=$!
echo "[LiHui] 博客服务器已启动 (PID: $SERVER_PID, 端口: 3001)"

echo ""
echo "[LiHui] 所有服务已启动！"
echo "[LiHui] 博客前台: http://localhost:3001"
echo "[LiHui] 博客管理: http://localhost:3001/admin/"
echo "[LiHui] 评论管理: http://localhost:3001/comment-admin/"
echo ""

cleanup() {
    echo ""
    echo "[LiHui] 正在停止服务..."
    kill $SERVER_PID $LIHUI_PID 2>/dev/null
    wait $SERVER_PID $LIHUI_PID 2>/dev/null
    echo "[LiHui] 所有服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

wait

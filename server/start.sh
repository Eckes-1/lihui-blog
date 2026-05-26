#!/bin/bash

MOMO_BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/Momo-Backend/nodejs"
SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[Momo] 正在启动 Momo-Backend 评论系统..."
cd "$MOMO_BACKEND_DIR"
node dist/app.js &
MOMO_PID=$!
echo "[Momo] Momo-Backend 已启动 (PID: $MOMO_PID, 端口: 3002)"

sleep 2

echo "[Momo] 正在启动博客服务器..."
cd "$SERVER_DIR"
node index.js &
SERVER_PID=$!
echo "[Momo] 博客服务器已启动 (PID: $SERVER_PID, 端口: 3001)"

echo ""
echo "[Momo] 所有服务已启动！"
echo "[Momo] 博客前台: http://localhost:3001"
echo "[Momo] 博客管理: http://localhost:3001/admin/"
echo "[Momo] 评论管理: http://localhost:3001/comment-admin/"
echo ""

cleanup() {
    echo ""
    echo "[Momo] 正在停止服务..."
    kill $SERVER_PID $MOMO_PID 2>/dev/null
    wait $SERVER_PID $MOMO_PID 2>/dev/null
    echo "[Momo] 所有服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

wait

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 1. NGÂN HÀNG CÂU HỎI
const questions = [
  {
    question: "Tác phẩm nào sau đây thuộc thể loại truyện thơ Nôm?",
    options: ["Truyện Kiều", "Nam quốc sơn hà", "Hịch tướng sĩ", "Bình Ngô đại cáo"],
    correct: 0,
    timeLimit: 15
  },
  {
    question: "Địa danh nào sau đây gắn liền với truyền thuyết Sơn Tinh - Thủy Tinh?",
    options: ["Núi Ba Vì", "Núi Yên Tử", "Núi Ngũ Hành", "Núi Sam"],
    correct: 0,
    timeLimit: 15
  }
];

let gameState = {
  status: 'LOBBY',
  currentQuestionIndex: -1,
  players: {},
  timer: null,
  timeLeft: 0
};

// 2. GIAO DIỆN HỌC VIÊN (PLAYER) - DÙNG TRÊN ĐIỆN THOẠI
const playerHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Tham gia Quiz</title>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .btn-touch { transition: transform 0.08s active; }
    .btn-touch:active { transform: scale(0.94); }
  </style>
</head>
<body class="bg-slate-900 text-white font-sans min-h-screen flex flex-col justify-center items-center p-4">

  <!-- Ô NHẬP TÊN (HIỆN NGAY KHI VÀO WEB) -->
  <div id="player-login" class="max-w-sm w-full bg-slate-800 p-6 rounded-2xl text-center space-y-4 shadow-2xl">
    <h2 class="text-2xl font-black text-emerald-400">Tham gia thi đấu</h2>
    <p class="text-slate-400 text-sm">Nhập họ tên của bạn để bắt đầu</p>
    <input id="player-name-input" type="text" placeholder="Họ và tên..." class="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
    <button onclick="joinGame()" class="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold text-lg shadow-lg">Vào phòng chờ</button>
  </div>

  <!-- PHÒNG CHỜ -->
  <div id="player-waiting" class="hidden text-center space-y-3">
    <div class="text-emerald-400 text-4xl font-black">✓ Sẵn sàng!</div>
    <p class="text-slate-300 text-lg">Chào <b id="display-name" class="text-white"></b></p>
    <p class="text-amber-400 text-sm animate-pulse">Hãy quan sát câu hỏi trên màn hình chiếu...</p>
  </div>

  <!-- BÀN BẤM 4 ĐÁP ÁN TRÊN ĐIỆN THOẠI -->
  <div id="player-controller" class="hidden fixed inset-0 p-4 bg-slate-900 flex flex-col justify-center">
    <div id="player-status" class="text-center font-bold text-slate-300 mb-4 text-base">Chọn đáp án tương ứng trên màn chiếu:</div>
    <div class="grid grid-cols-2 gap-4 flex-1 max-h-[75vh]">
      <button onclick="sendAnswer(0)" class="btn-touch bg-red-600 rounded-3xl text-5xl text-white font-black shadow-lg">▲</button>
      <button onclick="sendAnswer(1)" class="btn-touch bg-blue-600 rounded-3xl text-5xl text-white font-black shadow-lg">◆</button>
      <button onclick="sendAnswer(2)" class="btn-touch bg-amber-500 rounded-3xl text-5xl text-white font-black shadow-lg">●</button>
      <button onclick="sendAnswer(3)" class="btn-touch bg-emerald-600 rounded-3xl text-5xl text-white font-black shadow-lg">■</button>
    </div>
  </div>

  <!-- THÔNG BÁO CHỜ KẾT QUẢ CÂU VỪA RỒI -->
  <div id="player-result" class="hidden text-center space-y-3">
    <div id="result-status" class="text-3xl font-black"></div>
    <p class="text-slate-400 text-sm">Xem thứ hạng trên màn hình chiếu</p>
  </div>

  <script>
    const socket = io();

    function joinGame() {
      const name = document.getElementById('player-name-input').value;
      if (!name.trim()) return alert('Vui lòng nhập tên!');
      socket.emit('join_game', name);
    }

    socket.on('joined_successfully', (data) => {
      document.getElementById('player-login').classList.add('hidden');
      document.getElementById('player-waiting').classList.remove('hidden');
      document.getElementById('display-name').innerText = data.name;
    });

    socket.on('new_question', () => {
      document.getElementById('player-waiting').classList.add('hidden');
      document.getElementById('player-result').classList.add('hidden');
      document.getElementById('player-controller').classList.remove('hidden');
      document.getElementById('player-status').innerText = 'Chọn đáp án tương ứng:';
      document.querySelectorAll('.btn-touch').forEach(b => b.classList.remove('opacity-30', 'pointer-events-none'));
    });

    function sendAnswer(idx) {
      socket.emit('submit_answer', idx);
      document.getElementById('player-status').innerText = 'Đã gửi câu trả lời! Đang đợi đồng hồ...';
      document.querySelectorAll('.btn-touch').forEach(b => b.classList.add('opacity-30', 'pointer-events-none'));
    }

    socket.on('answer_feedback', (data) => {
      document.getElementById('player-controller').classList.add('hidden');
      document.getElementById('player-result').classList.remove('hidden');
      const statusEl = document.getElementById('result-status');
      if (data.isCorrect) {
        statusEl.innerText = 'CHÍNH XÁC! 🎉';
        statusEl.className = 'text-3xl font-black text-emerald-400';
      } else {
        statusEl.innerText = 'CHƯA CHÍNH XÁC! ❌';
        statusEl.className = 'text-3xl font-black text-rose-500';
      }
    });

    socket.on('game_over', () => {
      document.getElementById('player-controller').classList.add('hidden');
      document.getElementById('player-result').classList.remove('hidden');
      document.getElementById('result-status').innerText = 'HOÀN THÀNH BÀI THI! 🏆';
      document.getElementById('result-status').className = 'text-3xl font-black text-amber-400';
    });
  </script>
</body>
</html>
`;

// 3. GIAO DIỆN TRÌNH CHIẾU (HOST) - MÁY TÍNH CỦA BẠN
const hostHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Host Trình Chiếu</title>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-white font-sans min-h-screen flex flex-col justify-center items-center p-6">

  <!-- MÀN HÌNH CHỜ HOST -->
  <div id="host-lobby" class="max-w-4xl w-full text-center space-y-8">
    <div>
      <h1 class="text-4xl font-black text-indigo-400 tracking-wide">PHÒNG THI ĐẤU TRỰC TUYẾN</h1>
      <p class="text-slate-400 mt-2">Học viên truy cập bằng điện thoại để tham gia</p>
    </div>
    <div class="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
      <div class="text-xl text-slate-400 mb-4">Số lượng tham gia: <span id="player-count" class="font-extrabold text-emerald-400 text-4xl">0</span></div>
      <div id="lobby-player-list" class="flex flex-wrap gap-3 justify-center max-h-64 overflow-y-auto p-2"></div>
    </div>
    <button onclick="hostStartNext()" class="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-2xl font-black rounded-2xl shadow-xl transform active:scale-95 transition">Bắt đầu trò chơi 🚀</button>
  </div>

  <!-- MÀN HÌNH CÂU HỎI -->
  <div id="host-board" class="hidden max-w-5xl w-full space-y-6">
    <div class="flex justify-between items-center bg-slate-800 px-8 py-5 rounded-2xl shadow">
      <span id="question-progress" class="font-bold text-slate-400 text-2xl">Câu 1/2</span>
      <span id="host-timer" class="text-4xl font-black text-amber-400">15s</span>
    </div>
    <div id="host-question-text" class="text-3xl md:text-4xl font-extrabold text-center py-10 px-6 bg-slate-800 rounded-3xl shadow-xl min-h-[160px] flex items-center justify-center">Nội dung câu hỏi...</div>
    <div class="grid grid-cols-2 gap-5">
      <div id="opt-0" class="p-6 bg-red-600 rounded-2xl text-2xl font-bold flex items-center shadow-lg">▲ ...</div>
      <div id="opt-1" class="p-6 bg-blue-600 rounded-2xl text-2xl font-bold flex items-center shadow-lg">◆ ...</div>
      <div id="opt-2" class="p-6 bg-amber-500 rounded-2xl text-2xl font-bold flex items-center shadow-lg">● ...</div>
      <div id="opt-3" class="p-6 bg-emerald-600 rounded-2xl text-2xl font-bold flex items-center shadow-lg">■ ...</div>
    </div>
  </div>

  <!-- BẢNG XẾP HẠNG TOP ĐIỂM -->
  <div id="result-view" class="hidden max-w-2xl w-full bg-slate-800 p-8 rounded-3xl text-center space-y-6 shadow-2xl border border-slate-700">
    <h2 id="result-title" class="text-3xl font-black text-amber-400">BẢNG XẾP HẠNG TOP 5 🏆</h2>
    <div id="leaderboard-items" class="space-y-3 text-left"></div>
    <div id="host-next-wrapper" class="pt-4">
      <button onclick="hostStartNext()" class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xl shadow-lg">Câu tiếp theo ➡</button>
    </div>
  </div>

  <script>
    const socket = io();

    socket.on('update_player_list', (players) => {
      document.getElementById('player-count').innerText = players.length;
      document.getElementById('lobby-player-list').innerHTML = players.map(name => 
        '<span class=\"px-4 py-2 bg-slate-700 rounded-full text-base font-bold text-slate-200 border border-slate-600\">' + name + '</span>'
      ).join('');
    });

    function hostStartNext() {
      socket.emit('host_next_question');
    }

    socket.on('new_question', (data) => {
      document.getElementById('host-lobby').classList.add('hidden');
      document.getElementById('result-view').classList.add('hidden');
      document.getElementById('host-board').classList.remove('hidden');

      document.getElementById('question-progress').innerText = 'Câu ' + data.index + '/' + data.total;
      document.getElementById('host-timer').innerText = data.timeLimit + 's';
      document.getElementById('host-question-text').innerText = data.question;

      const shapes = ['▲', '◆', '●', '■'];
      data.options.forEach((opt, idx) => {
        document.getElementById('opt-' + idx).innerText = shapes[idx] + ' ' + opt;
      });
    });

    socket.on('time_tick', (sec) => {
      document.getElementById('host-timer').innerText = sec + 's';
    });

    socket.on('round_result', (data) => {
      document.getElementById('host-board').classList.add('hidden');
      document.getElementById('result-view').classList.remove('hidden');
      renderLeaderboard(data.leaderboard, 'BẢNG XẾP HẠNG TOP 5 🏆');
    });

    socket.on('game_over', (leaderboard) => {
      document.getElementById('host-board').classList.add('hidden');
      document.getElementById('host-next-wrapper').classList.add('hidden');
      document.getElementById('result-view').classList.remove('hidden');
      renderLeaderboard(leaderboard.slice(0, 10), 'KẾT QUẢ CHUNG CUỘC 🏆');
    });

    function renderLeaderboard(list, title) {
      document.getElementById('result-title').innerText = title;
      document.getElementById('leaderboard-items').innerHTML = list.map((p, i) => 
        '<div class=\"flex justify-between items-center p-4 ' + (i === 0 ? 'bg-amber-500/20 border border-amber-500' : 'bg-slate-700') + ' rounded-2xl font-bold text-lg\">' +
          '<span>#' + (i + 1) + ' ' + p.name + '</span>' +
          '<span class=\"text-amber-400 font-extrabold\">' + p.score + ' điểm</span>' +
        '</div>'
      ).join('');
    }
  </script>
</body>
</html>
`;

// ĐƯỜNG DẪN 1: Dành cho Học viên vào thẳng màn hình nhập tên
app.get('/', (req, res) => {
  res.send(playerHtml);
});

// ĐƯỜNG DẪN 2: Dành cho Giáo viên mở trên máy chiếu
app.get('/host', (req, res) => {
  res.send(hostHtml);
});

// 4. XỬ LÝ SỰ KIỆN GAME THỜI GIAN THỰC
io.on('connection', (socket) => {
  socket.on('join_game', (playerName) => {
    if (gameState.status !== 'LOBBY') {
      socket.emit('error_message', 'Game đã bắt đầu!');
      return;
    }
    gameState.players[socket.id] = {
      name: playerName.trim() || 'Người chơi',
      score: 0,
      answered: false
    };
    socket.emit('joined_successfully', { name: gameState.players[socket.id].name });
    io.emit('update_player_list', Object.values(gameState.players).map(p => p.name));
  });

  socket.on('host_next_question', () => {
    gameState.currentQuestionIndex++;
    if (gameState.currentQuestionIndex >= questions.length) {
      gameState.status = 'FINAL';
      const leaderboard = Object.values(gameState.players).sort((a, b) => b.score - a.score);
      io.emit('game_over', leaderboard);
      return;
    }

    gameState.status = 'QUESTION';
    const currentQ = questions[gameState.currentQuestionIndex];
    gameState.timeLeft = currentQ.timeLimit;

    for (let id in gameState.players) {
      gameState.players[id].answered = false;
    }

    io.emit('new_question', {
      index: gameState.currentQuestionIndex + 1,
      total: questions.length,
      question: currentQ.question,
      options: currentQ.options,
      timeLimit: currentQ.timeLimit
    });

    clearInterval(gameState.timer);
    gameState.timer = setInterval(() => {
      gameState.timeLeft--;
      io.emit('time_tick', gameState.timeLeft);

      if (gameState.timeLeft <= 0) {
        clearInterval(gameState.timer);
        showRoundResult();
      }
    }, 1000);
  });

  socket.on('submit_answer', (selectedIndex) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.status !== 'QUESTION' || player.answered) return;

    player.answered = true;
    const currentQ = questions[gameState.currentQuestionIndex];
    const isCorrect = selectedIndex === currentQ.correct;

    if (isCorrect) {
      const speedBonus = Math.round((gameState.timeLeft / currentQ.timeLimit) * 500);
      player.score += (500 + speedBonus);
    }

    socket.emit('answer_feedback', { isCorrect });

    const allAnswered = Object.values(gameState.players).every(p => p.answered);
    if (allAnswered) {
      clearInterval(gameState.timer);
      showRoundResult();
    }
  });

  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
      io.emit('update_player_list', Object.values(gameState.players).map(p => p.name));
    }
  });
});

function showRoundResult() {
  gameState.status = 'RESULT';
  const currentQ = questions[gameState.currentQuestionIndex];
  const leaderboard = Object.values(gameState.players)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  io.emit('round_result', {
    correctIndex: currentQ.correct,
    leaderboard
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));

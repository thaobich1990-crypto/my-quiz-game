const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Ngân hàng câu hỏi
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

// Giao diện web được nhúng trực tiếp
const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Realtime Quiz</title>
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .btn-shape { transition: transform 0.1s; }
    .btn-shape:active { transform: scale(0.96); }
  </style>
</head>
<body class="bg-slate-900 text-white font-sans min-h-screen flex flex-col justify-center items-center p-4">
  <div id="role-selection" class="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-xl text-center space-y-4">
    <h1 class="text-3xl font-extrabold text-indigo-400">Quiz Game</h1>
    <p class="text-slate-400 text-sm">Chọn vai trò thiết bị của bạn:</p>
    <div class="space-y-3 pt-2">
      <button onclick="setupHost()" class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg shadow">🖥️ Màn hình Chiếu (Host)</button>
      <button onclick="setupPlayer()" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg shadow">📱 Người chơi (Mobile)</button>
    </div>
  </div>

  <div id="player-login" class="hidden max-w-sm w-full bg-slate-800 p-6 rounded-2xl text-center space-y-4">
    <h2 class="text-2xl font-bold text-emerald-400">Tham gia thi đấu</h2>
    <input id="player-name-input" type="text" placeholder="Nhập tên của bạn..." class="w-full px-4 py-3 bg-slate-700 rounded-lg text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400" />
    <button onclick="joinGame()" class="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-bold">Vào phòng chờ</button>
  </div>

  <div id="host-lobby" class="hidden max-w-3xl w-full text-center space-y-6">
    <h2 class="text-3xl font-bold">Phòng chờ thi đấu</h2>
    <div class="bg-slate-800 p-6 rounded-2xl shadow-lg">
      <div class="text-lg text-slate-400 mb-2">Đã kết nối: <span id="player-count" class="font-bold text-emerald-400 text-2xl">0</span> người chơi</div>
      <div id="lobby-player-list" class="flex flex-wrap gap-2 justify-center max-h-56 overflow-y-auto p-2"></div>
    </div>
    <button onclick="hostStartNext()" class="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-2xl font-black rounded-2xl shadow-lg">Bắt đầu trò chơi 🚀</button>
  </div>

  <div id="host-board" class="hidden max-w-4xl w-full space-y-6">
    <div class="flex justify-between items-center bg-slate-800 px-6 py-4 rounded-xl">
      <span id="question-progress" class="font-bold text-slate-400 text-lg">Câu 1/2</span>
      <span id="host-timer" class="text-3xl font-black text-amber-400">15s</span>
    </div>
    <div id="host-question-text" class="text-2xl md:text-3xl font-extrabold text-center py-6 bg-slate-800 rounded-2xl shadow">Nội dung câu hỏi...</div>
    <div class="grid grid-cols-2 gap-4">
      <div id="opt-0" class="p-6 bg-red-600 rounded-2xl text-xl font-bold flex items-center">▲ ...</div>
      <div id="opt-1" class="p-6 bg-blue-600 rounded-2xl text-xl font-bold flex items-center">◆ ...</div>
      <div id="opt-2" class="p-6 bg-amber-500 rounded-2xl text-xl font-bold flex items-center">● ...</div>
      <div id="opt-3" class="p-6 bg-emerald-600 rounded-2xl text-xl font-bold flex items-center">■ ...</div>
    </div>
  </div>

  <div id="player-controller" class="hidden fixed inset-0 p-4 bg-slate-900 flex flex-col justify-center">
    <div id="player-status-bar" class="text-center font-bold text-slate-400 mb-4">Chọn đáp án trên màn hình:</div>
    <div class="grid grid-cols-2 gap-4 flex-1 max-h-[75vh]">
      <button onclick="sendAnswer(0)" class="btn-shape bg-red-600 rounded-3xl text-4xl text-white font-black shadow-lg">▲</button>
      <button onclick="sendAnswer(1)" class="btn-shape bg-blue-600 rounded-3xl text-4xl text-white font-black shadow-lg">◆</button>
      <button onclick="sendAnswer(2)" class="btn-shape bg-amber-500 rounded-3xl text-4xl text-white font-black shadow-lg">●</button>
      <button onclick="sendAnswer(3)" class="btn-shape bg-emerald-600 rounded-3xl text-4xl text-white font-black shadow-lg">■</button>
    </div>
  </div>

  <div id="result-view" class="hidden max-w-xl w-full bg-slate-800 p-8 rounded-2xl text-center space-y-6">
    <h2 class="text-3xl font-black text-amber-400">Top 5 Dẫn Đầu 🏆</h2>
    <div id="leaderboard-items" class="space-y-3 text-left"></div>
    <div id="host-next-wrapper" class="hidden pt-4">
      <button onclick="hostStartNext()" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg">Câu tiếp theo ➡</button>
    </div>
  </div>

  <script>
    const socket = io();
    let isHost = false;

    function setupHost() {
      isHost = true;
      document.getElementById('role-selection').classList.add('hidden');
      document.getElementById('host-lobby').classList.remove('hidden');
    }

    function setupPlayer() {
      isHost = false;
      document.getElementById('role-selection').classList.add('hidden');
      document.getElementById('player-login').classList.remove('hidden');
    }

    function joinGame() {
      const name = document.getElementById('player-name-input').value;
      if (!name.trim()) return alert('Vui lòng nhập tên!');
      socket.emit('join_game', name);
    }

    socket.on('joined_successfully', (data) => {
      document.getElementById('player-login').innerHTML = '<div class=\"text-emerald-400 text-3xl font-black\">✓ Sẵn sàng!</div><p class=\"text-slate-300 mt-2\">Chào <b>' + data.name + '</b>, hãy nhìn lên màn hình chiếu lớn.</p>';
    });

    socket.on('update_player_list', (players) => {
      if (!isHost) return;
      document.getElementById('player-count').innerText = players.length;
      document.getElementById('lobby-player-list').innerHTML = players.map(name => '<span class=\"px-3 py-1 bg-slate-700 rounded-full text-sm font-semibold text-slate-200\">' + name + '</span>').join('');
    });

    function hostStartNext() {
      socket.emit('host_next_question');
    }

    socket.on('new_question', (data) => {
      document.getElementById('result-view').classList.add('hidden');
      if (isHost) {
        document.getElementById('host-lobby').classList.add('hidden');
        document.getElementById('host-board').classList.remove('hidden');
        document.getElementById('question-progress').innerText = 'Câu ' + data.index + '/' + data.total;
        document.getElementById('host-timer').innerText = data.timeLimit + 's';
        document.getElementById('host-question-text').innerText = data.question;
        const shapes = ['▲', '◆', '●', '■'];
        data.options.forEach((opt, idx) => {
          document.getElementById('opt-' + idx).innerText = shapes[idx] + ' ' + opt;
        });
      } else {
        document.getElementById('player-login').classList.add('hidden');
        document.getElementById('player-controller').classList.remove('hidden');
        document.getElementById('player-status-bar').innerText = 'Chọn đáp án trên màn hình:';
      }
    });

    socket.on('time_tick', (sec) => {
      if (isHost) document.getElementById('host-timer').innerText = sec + 's';
    });

    function sendAnswer(idx) {
      socket.emit('submit_answer', idx);
      document.getElementById('player-status-bar').innerText = 'Đã gửi đáp án! Chờ kết quả...';
      document.querySelectorAll('.btn-shape').forEach(b => b.classList.add('opacity-30', 'pointer-events-none'));
    }

    socket.on('round_result', (data) => {
      if (isHost) {
        document.getElementById('host-board').classList.add('hidden');
        document.getElementById('host-next-wrapper').classList.remove('hidden');
      } else {
        document.getElementById('player-controller').classList.add('hidden');
        document.querySelectorAll('.btn-shape').forEach(b => b.classList.remove('opacity-30', 'pointer-events-none'));
      }
      document.getElementById('result-view').classList.remove('hidden');
      document.getElementById('leaderboard-items').innerHTML = data.leaderboard.map((p, i) => 
        '<div class=\"flex justify-between items-center p-3 ' + (i === 0 ? 'bg-amber-500/20 border border-amber-500' : 'bg-slate-700') + ' rounded-xl font-bold\"><span>#' + (i + 1) + ' ' + p.name + '</span><span class=\"text-amber-400\">' + p.score + ' điểm</span></div>'
      ).join('');
    });

    socket.on('game_over', (leaderboard) => {
      document.getElementById('host-board').classList.add('hidden');
      document.getElementById('player-controller').classList.add('hidden');
      document.getElementById('host-next-wrapper').classList.add('hidden');
      document.getElementById('result-view').classList.remove('hidden');
      document.getElementById('result-view').querySelector('h2').innerText = 'KẾT THÚC CHUNG CUỘC 🏆';
      document.getElementById('leaderboard-items').innerHTML = leaderboard.slice(0, 10).map((p, i) => 
        '<div class=\"flex justify-between items-center p-3 bg-slate-700 rounded-xl font-bold\"><span>#' + (i + 1) + ' ' + p.name + '</span><span class=\"text-amber-400\">' + p.score + ' điểm</span></div>'
      ).join('');
    });
  </script>
</body>
</html>
`;

// Trả thẳng giao diện khi người dùng truy cập trang chủ
app.get('/', (req, res) => {
  res.send(htmlContent);
});

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
    if (selectedIndex === currentQ.correct) {
      const speedBonus = Math.round((gameState.timeLeft / currentQ.timeLimit) * 500);
      player.score += (500 + speedBonus);
    }

    socket.emit('answer_received', { isCorrect: selectedIndex === currentQ.correct });

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

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// Ngân hàng câu hỏi mẫu (Bạn có thể sửa text ở đây tùy ý)
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
  status: 'LOBBY', // LOBBY, QUESTION, RESULT, FINAL
  currentQuestionIndex: -1,
  players: {}, // socketId -> { name, score, answeredThisTurn }
  timer: null,
  timeLeft: 0
};

io.on('connection', (socket) => {
  // Người chơi tham gia phòng
  socket.on('join_game', (playerName) => {
    if (gameState.status !== 'LOBBY') {
      socket.emit('error_message', 'Game đã bắt đầu, không thể tham gia lúc này!');
      return;
    }
    gameState.players[socket.id] = {
      name: playerName.trim() || 'Người chơi ẩn danh',
      score: 0,
      answered: false
    };
    socket.emit('joined_successfully', { name: gameState.players[socket.id].name });
    io.emit('update_player_list', Object.values(gameState.players).map(p => p.name));
  });

  // Host bấm nút chuyển câu tiếp theo
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

    // Reset trạng thái trả lời của người chơi
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

    // Bắt đầu đếm ngược thời gian
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

  // Người chơi bấm chọn đáp án
  socket.on('submit_answer', (selectedIndex) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.status !== 'QUESTION' || player.answered) return;

    player.answered = true;
    const currentQ = questions[gameState.currentQuestionIndex];
    const isCorrect = selectedIndex === currentQ.correct;

    if (isCorrect) {
      // Điểm cơ bản 500 + điểm tốc độ (tối đa 500)
      const speedBonus = Math.round((gameState.timeLeft / currentQ.timeLimit) * 500);
      player.score += (500 + speedBonus);
    }

    socket.emit('answer_received', { isCorrect });

    // Kiểm tra nếu tất cả đã trả lời thì chốt câu hỏi luôn
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
    .slice(0, 5); // Lấy Top 5 dẫn đầu

  io.emit('round_result', {
    correctIndex: currentQ.correct,
    leaderboard
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));
import express from "express";
import { createServer } from "http";
import { Server as SocketIoServer } from "socket.io";
import path from "path";
// import { generateNetworkID } from "./src/components/networkIdGenerator";

const app = express();
const server = createServer(app);

const io = new SocketIoServer(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.use((socket, next) => {
  if (socket.handshake.query.token === "UNITY") {
    next();
    console.log("authentication passed");
  } else {
    next(new Error("authentication error"));
    console.log("authentication failed");
  }
});

let users = {};
let rooms = { global: { password: "1221", users: [] } };

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.emit("Connect", { date: new Date().getTime(), data: "Hello Unity" });

  users[socket.id] = {
    x: 0,
    y: 0,
    z: 0,
    rooms: ["global"],
  };

  const globalRoom = (id, condition) => {
    switch (condition) {
      case "JOIN":
        console.log("user join global", id);
        socket.join("global");
        if (!users[id].rooms.includes("global")) {
          users[id].rooms = [...users[id].rooms, "global"];
        }
        rooms["global"].users = [...rooms["global"]?.users, id];
        break;
      case "LEAVE":
        console.log("user leave global", id);
        socket.leave("global");
        users[id].rooms = users[id].rooms.filter(
          (room) => room !== "global"
        );
        rooms["global"].users = rooms["global"].users.filter(
          (user) => user !== id
        );
        break;
      default:
        break;
    }
  };

  globalRoom(socket.id, 'JOIN');

  socket.broadcast.emit("playerJoin", socket.id);

  // LOBBY
  socket.on("createRoom", (data) => {
    const { roomId, password } = JSON.parse(data);
    console.log("jsonData", roomId, password);

    if (!rooms[roomId]) {
      rooms[roomId] = { password, users: [] };
      socket.emit("roomCreated", roomId);
      socket.emit("returnAllRooms", rooms);
      socket.broadcast.emit("returnAllRooms", rooms);
      console.log(`Utworzono pokój o ID: ${roomId}`);
    } else {
      socket.emit("roomExists", roomId);
    }
  });

  socket.on("joinRoom", (data) => {
    const { roomId, password } = JSON.parse(data);
    globalRoom(socket.id, 'LEAVE');

    if (rooms[roomId]) {
      if (rooms[roomId].password === password) {
        rooms[roomId].users = [...rooms[roomId]?.users, socket.id];
        users[socket.id].rooms = [...users[socket.id].rooms, roomId];
        socket.join(roomId);

        console.log(
          `Użytkownik ${socket.id} dołączył do pokoju o ID: ${roomId}`
        );

        io.to(users[socket.id].rooms).emit("playerJoin", socket.id);
      } else {
        socket.emit("incorrectPassword", roomId);
      }
    } else {
      socket.emit("roomNotFound", roomId);
    }
  });

  socket.on("leaveRoom", (data) => {
    const { roomId } = JSON.parse(data);
    const userId = socket.id;
    globalRoom(socket.id, 'JOIN');
    if (users[userId]) {
      socket.leave(roomId);
      users[userId].rooms = users[userId].rooms.filter(
        (room) => room !== roomId
      );
      rooms[roomId].users = rooms[roomId].users.filter(
        (user) => user !== userId
      );
      console.log(`Użytkownik o id ${userId} opuścił pokój ${roomId}`);
      io.to(users[socket.id].rooms).emit("playerLeave", socket.id);
    } else {
      socket.emit("roomNotFound", roomId);
    }
  });

  socket.on("ServerList", () => {
    socket.broadcast.emit("ServerList", rooms);
    io.to(users[socket.id].rooms).emit("ServerList", rooms);
    socket.emit("ServerList", rooms);
  });

  socket.broadcast.emit("userConnected", socket.id, users[socket.id]);

  socket.on("movement", (data) => {
    users[socket.id].x = data.x;
    users[socket.id].y = data.y;
    users[socket.id].z = data.z;
    io.to(users[socket.id].rooms).emit("roomTest", data);
  });

  // Actions
  socket.on("pickupItem", (itemId) => {
    users[socket.id].handledItem = itemId;
    io.to(users[socket.id].rooms).emit("pickupItem", data);
  });
  socket.on("head", (data) => {
    users[socket.id].head = data;
    io.to(users[socket.id].rooms).emit("head", data);
    io.to(users[socket.id].rooms).emit("headTest", socket.id, users[socket.id].rooms, data);
    console.log('socket roms', socket.rooms, 'user rooms', users[socket.id].rooms, 'rooms', rooms)
  });
  socket.on("head2", (data) => {
    console.log("head2", data);
    users[socket.id].head = data;
    if (users[socket.id].rooms.length > 0) {
      io.to(users[socket.id].rooms).emit("head2room", data);
    } else {
      socket.broadcast.emit("head2global", data);
      socket.emit("head2global", data);
    }
  });
  socket.on("rHand", (data) => {
    users[socket.id].rHand = data;
    console.log("rhand", socket.id, users[socket.id].rooms);
    io.to(users[socket.id].rooms).emit("rHand", data);
  });
  socket.on("lHand", (data) => {
    users[socket.id].lHand = data;
    io.to(users[socket.id].rooms).emit("lHand", data);
  });
  socket.on("apperance", (data) => {
    users[socket.id].apperance = data;
    io.to(users[socket.id].rooms).emit("apperance", data);
  });
  socket.on("gesture", (data) => {
    users[socket.id].gesture = data;
    io.to(users[socket.id].rooms).emit("gesture", data);
  });
  socket.on("playerStatus", (data) => {
    console.log("playerStatus", socket.id);
    users[socket.id].playerStatus = data;
    io.to(users[socket.id].rooms).emit("playerStatus", data);
  });
  socket.on("itemPick", (data) => {
    console.log("itemPick", socket.id);
    users[socket.id].itemPick = data;
    io.to(users[socket.id].rooms).emit("itemPick", data);
  });
  socket.on("respawnItem", (data) => {
    console.log("respawnItem", socket.id);
    users[socket.id].respawnItem = data;
    io.to(users[socket.id].rooms).emit("respawnItem", data);
  });

  //INTERACTIVE ZONES
  socket.on("enterZones", (data) => {
    console.log("enterZones", socket.id);
    users[socket.id].enterZones = data;
    io.to(users[socket.id].rooms).emit("enterZones", data);
  });
  socket.on("interactiveZones", (data) => {
    console.log("interactiveZones", socket.id);
    users[socket.id].interactiveZones = data;
    io.to(users[socket.id].rooms).emit("interactiveZones", data);
  });
  socket.on("placeZones", (data) => {
    console.log("placeZones", socket.id);
    users[socket.id].placeZones = data;
    io.to(users[socket.id].rooms).emit("placeZones", data);
  });



  socket.on("OnDataReceived", (data) => {
    socket.emit("OnDataReceived", data);
    console.log("data received:", data);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    delete users[socket.id];
    socket.broadcast.emit("userDisconnected", socket.id);

    for (const roomId in rooms) {
      if (rooms[roomId].users[socket.id]) {
        delete rooms[roomId].users[socket.id];
        socket.leave(roomId);
        io.to(roomId).emit("userDisconnected", socket.id);
        console.log(`Użytkownik ${socket.id} opuścił pokój o ID: ${roomId}`);
      }
    }
  });
});

// ENDPOINTS
app.post("/run-action", (req, res) => {
  console.log(users);
  io.emit("OnDataReceived");
  res.send("Sent /run-action");
});

const __dirname = path.resolve();

app.get("/socket-interface", (req, res) => {
  console.log(`${__dirname}/webinterface/index.html`);
  const htmlPath = `${__dirname}/webinterface/index.html`;
  res.sendFile(htmlPath);
});

// server.listen(3001, "192.168.70.16", () => {
//   console.log("server running at http://192.168.70.16:3001");
// });

server.listen(3001, () => {
  console.log("server running at http://localhost:3001");
});

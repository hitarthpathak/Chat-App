const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
    let file = "";
    if (req.url === "/" || req.url === "/index.html") file = "index.html";
    else if (req.url === "/style.css") file = "style.css";
    else if (req.url === "/script.js") file = "script.js";
    else if (req.url === "/Images/Icon.png") file = "Images/Icon.png";

    if (file) {
        fs.readFile(file, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end("File Not Found");
            } else {
                let type = "text/html";
                if (file === "style.css") type = "text/css";
                if (file === "script.js") type = "application/javascript";
                if (file.endsWith(".png")) type = "image/png";
                res.writeHead(200, { "Content-Type": type });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end("Not found");
    }
});

const wss = new WebSocket.Server({ server });

const chat_app_users = [];
const already_active_user = {};

wss.on("connection", (ws) => {
    console.log("New Client Connected!");
    let user_id = Date.now();
    ws.on("message", (message) => {
        try {
            let data = JSON.parse(message);
            console.log("Received Message : ", data);
            if (data.type == "heartbeat") {
                console.log("Heartbeat Received From A User!");
                return;
            }
            else if (data.type == "join") {
                if (already_active_user[data.user.trim()] && already_active_user[data.user.trim()] != ws) {
                    ws.send(JSON.stringify({ type: "session-conflict", message: "You Are Already Joined On Another Session. Do You Want To End Previous Session And Create A New One?" }));
                    return;
                }
                let existing_user = chat_app_users.findIndex((user) => user.user == data.user.trim());
                if (existing_user >= 0) {
                    chat_app_users.splice(existing_user, 1);
                }
                chat_app_users.push({ id: user_id, user: data.user.trim() });
                already_active_user[data.user.trim()] = ws;
                ws.send(JSON.stringify({ type: "join", id: user_id }));
                broadcast({ type: "user-list", users: chat_app_users });
                broadcast({ type: "join", message: `${data.user.trim()} Joined The Chat.` });
                return;
            }
            else if (data.type == "take-over") {
                if (already_active_user[data.user.trim()] && already_active_user[data.user.trim()] != ws) {
                    let old_ws = already_active_user[data.user.trim()];
                    old_ws.send(JSON.stringify({ type: "kicked-out", message: "Your Session Has Been Taken Over By Another Session." }));
                    old_ws.close();
                }
                let existing_user_index = chat_app_users.findIndex((user) => user.user == data.user.trim());
                if (existing_user_index >= 0) {
                    chat_app_users.splice(existing_user_index, 1);
                }
                chat_app_users.push({ id: user_id, user: data.user.trim() });
                already_active_user[data.user.trim()] = ws;
                ws.send(JSON.stringify({ type: "join", id: user_id }));
                broadcast({ type: "user-list", users: chat_app_users });
                broadcast({ type: "join", message: `${data.user.trim()} Joined The Chat.` });
                return;
            }
            else if (data.type == "leave") {
                let user_index = chat_app_users.findIndex((user) => user.id == user_id);
                if (user_index >= 0) {
                    chat_app_users.splice(user_index, 1);
                    delete already_active_user[data.user.trim()];
                    ws.send(JSON.stringify({ type: "leave" }));
                    broadcast({ type: "user-list", users: chat_app_users });
                    broadcast({ type: "leave", message: `${data.user.trim()} Left The Chat.` });
                    return;
                }
            }
            else if (data.type == "message") {
                broadcast({ type: "message", user: data.user.trim(), message: data.message });
                return;
            }
        } catch (error) {
            console.error("Server Error : ", error);
        }
    });

    ws.on("close", () => {
        let user_index = chat_app_users.findIndex((user) => user.id == user_id);
        if (user_index >= 0) {
            let leaving_user = chat_app_users[user_index];
            chat_app_users.splice(user_index, 1);
            if (already_active_user[leaving_user.user] == ws) {
                delete already_active_user[leaving_user.user];
            }
            broadcast({ type: "user-list", users: chat_app_users });
            broadcast({ type: "leave", message: `${leaving_user.user} Left The Chat.` });
        }
    });
});

function broadcast(data) {
    let string_data = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState == WebSocket.OPEN) {
            client.send(string_data);
        }
    });
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server Is Listening On Port : ${PORT}!`);
});
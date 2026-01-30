let current_user_name = document.getElementById('current-user-name');
let another_user_name = document.getElementById('another-user-name');
let join_chat_button = document.getElementById('join-chat-button');
let chat_messages = document.getElementById('chat-messages-box');
let user_input = document.getElementById('user-input');
let message_send_button = document.getElementById('message-send-button');
let press_enter_to_send = document.getElementById('press-enter-to-send');

let socket = new WebSocket("https://chat-app-ii65.onrender.com");
let heartbeat;
let current_user = "";
let current_user_id = "";
let is_joined = false;

window.addEventListener('load', function () {
    set_default_view();
});

function set_default_view() {
    is_joined = false;
    clearInterval(heartbeat);
    chat_messages.innerHTML = `
        
        <p style="height:100%; width:100%; display: flex; align-items: center; justify-content: center;">Please Join The Chat To Message.</p>
        
    `;
    current_user = "";
    current_user_id = "";
    current_user_name.textContent = "";
    another_user_name.textContent = "";
    join_chat_button.textContent = "Join Chat";
    join_chat_button.onclick = join_chat;
    user_input.value = "";
    disable_input_fields();
};

function disable_input_fields() {
    user_input.disabled = true;
    message_send_button.disabled = true;
    message_send_button.style.cursor = "auto";
    press_enter_to_send.disabled = true;
};

function enable_input_fields() {
    user_input.disabled = false;
    message_send_button.disabled = false;
    message_send_button.style.cursor = "pointer";
    press_enter_to_send.disabled = false;
};

function show_chat_updates(message) {
    let chat_updates_box = document.createElement('div');
    chat_updates_box.classList.add('chat-updates-box');
    chat_updates_box.innerHTML = `
        <p class="chat-update-message">${message}</p>
    `;
    chat_messages.appendChild(chat_updates_box);
    chat_messages.scrollTop = chat_messages.scrollHeight;
};

function join_chat() {
    let joined_user = prompt("Enter Your Name To Join The Chat :");
    if (!joined_user || joined_user.trim() == "") {
        return;
    }
    current_user = joined_user.trim();
    socket.send(JSON.stringify({ type: "join", user: current_user }));
    is_joined = true;
    clearInterval(heartbeat);
    heartbeat = setInterval(() => {
        if (socket.readyState == WebSocket.OPEN && is_joined) {
            socket.send(JSON.stringify({ type: "heartbeat" }));
        }
    }, 60000);
};

function leave_chat() {
    if (!current_user) {
        return;
    }
    let confirm_leave = confirm("Are You Sure You Want To Leave The Chat?");
    if (!confirm_leave) {
        return;
    }
    else {
        clearInterval(heartbeat);
        socket.send(JSON.stringify({ type: "leave", user: current_user }));
        set_default_view();
    }
};

user_input.addEventListener('keypress', function (e) {
    if (press_enter_to_send.checked && e.key == 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send_message();
    }
});

function send_message() {
    if (!current_user) {
        return;
    }
    let message = user_input.value.trim();
    if (message) {
        socket.send(JSON.stringify({ type: "message", user: current_user, message: message }));
        user_input.value = "";
    }
};

socket.onopen = function () {
    console.log("Connected To The Server!");
};

socket.onclose = function () {
    console.log("Disconnected From The Server!");
    clearInterval(heartbeat);
};

socket.onerror = function (error) {
    console.error("WebSocket Error : ", error);
};

socket.onmessage = function (event) {
    if (!is_joined) {
        return;
    }
    let data = JSON.parse(event.data);
    if (data) {
        if (data.type == "join") {
            if (data.id) {
                current_user_id = data.id;
            }
            if (data.message) {
                show_chat_updates(data.message);
                return;
            }
            chat_messages.innerHTML = "";
            current_user_name.textContent = current_user;
            enable_input_fields();

            join_chat_button.textContent = "Leave Chat";
            join_chat_button.onclick = leave_chat;
        }
        if (data.type == "session-conflict") {
            if (confirm(data.message)) {
                socket.send(JSON.stringify({ type: "take-over", user: current_user }));
            } else {
                set_default_view();
            }
            return;
        }
        if (data.type == "kicked-out") {
            alert(data.message);
            set_default_view();
            return;
        }
        if (data.type == "leave") {
            if (data.message) {
                show_chat_updates(data.message);
                return;
            }
        }
        if (data.type == "user-list") {
            another_user_name.innerHTML = data.users.filter((user) => user.user != current_user).map((u) => `<span class="another-user">${u.user}</span>`).join(", ") || "No Other Users Online";
            let me = data.users.find((user) => user.user == current_user);
            if (me) {
                current_user_id = me.id;
            }
            return;
        }
        if (data.type == "message") {
            let message_box = document.createElement('div');
            message_box.classList.add('message-box');
            if (data.user == current_user) {
                message_box.classList.add('current-user-message-box');
            } else {
                message_box.classList.add('another-user-message-box');
            }
            message_box.innerHTML = `
    
                <div class="message-meta-data">
    
                    <span><b>${data.user}</b> | <i>${new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</i></span> | <span><i>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</i></span>
    
                </div>

                <hr />

                <p class="message">${data.message}</p>
    
            `;
            chat_messages.appendChild(message_box);
            chat_messages.scrollTop = chat_messages.scrollHeight;
        }
    }
    else {
        console.error("Invalid Data Received From Server!");
    }
};
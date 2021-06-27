function frontAlert(text) {
    let alert = document.getElementById('frontAlert');
    if (alert) alert.innerText = text;
}

function login() {
    let usernameInput = document.getElementById('username').value;
    let passwordInput = document.getElementById('password').value;
    if (!usernameInput || !passwordInput) return frontAlert('Форма пуста.');

    return fetch("/api/login", {
        method: "POST",
        headers: {
            'Content-Type': "application/json"
        },
        body: JSON.stringify({
            username: usernameInput,
            password: passwordInput
        })
    }).then(r => r.json()).then(r => {
        frontAlert(r.message);
        if (r.ok) setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    });
}

function register() {
    let usernameInput = document.getElementById('username').value;
    let passwordInput = document.getElementById('password').value;
    let codeInput = document.getElementById('code').value;
    if (!usernameInput || !passwordInput || !codeInput) return frontAlert('Форма пуста.');

    return fetch("/api/register", {
        method: "POST",
        headers: {
            'Content-Type': "application/json"
        },
        body: JSON.stringify({
            username: usernameInput,
            password: passwordInput,
            code: codeInput
        })
    }).then(r => r.json()).then(r => {
        frontAlert(r.message);
        if (r.ok) setTimeout(() => {
            window.location.href = '/login';
        }, 10000);
    });
}

function deleteFile(fileID) {
    if (!fileID) return alert('Нет ID файла.');

    let prompt = confirm('Вы действительно хотите удалить данный файл?');
    if (prompt) return fetch("/api/uploads/delete", {
        method: "POST",
        headers: {
            'Content-Type': "application/json"
        },
        body: JSON.stringify({
            id: fileID
        })
    }).then(r => r.json()).then(r => {
        if (r.ok) {
            alert(r.message);
            document.getElementById(`file-${fileID}`).innerHTML = "";
        }
    });
}

function createInvite() {
    let uses = prompt('Сколько использований?', 1);
    if (uses) return fetch("/api/invite/create", {
        method: "POST",
        headers: {
            'Content-Type': "application/json"
        },
        body: JSON.stringify({
            uses: Number(uses)
        })
    }).then(r => r.json()).then(r => {
        if (r.ok) window.location.reload();
    });
}

function deleteInvite(inviteID) {
    if (!inviteID) return alert('Нет ID инвайта.');

    return fetch("/api/invite/delete", {
        method: "POST",
        headers: {
            'Content-Type': "application/json"
        },
        body: JSON.stringify({
            code: inviteID
        })
    }).then(r => r.json()).then(r => {
        if (r.ok)
            document.getElementById(`invite-${inviteID}`).innerHTML = "";
    });
}

function truncateInvites() {
    let prompt = confirm('Вы действительно хотите очистить все инвайт-коды?');
    if (prompt) return fetch("/api/invite/truncate", {
        method: "POST",
        headers: {
            'Content-Type': "application/json"
        },
    }).then(r => r.json()).then(r => {
        if (r.ok) window.location.reload();
    });
}
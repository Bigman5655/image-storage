/*
MIT License

Copyright (c) 2021 https://sqdsh.top

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const config = require('./config.json');
const crypto = require('./crypto')(config.database.encrypt_key);

const {
    Sequelize
} = require('sequelize');
const sequelize = new Sequelize(config.database.database_name, config.database.username, config.database.password, {
    host: config.database.host,
    dialect: config.database.dialect,
    logging: false
});

async function authenticate() {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}
authenticate();

const User = require('./models/user')(sequelize);
const Invite = require('./models/invite')(sequelize);
const Upload = require('./models/uploads')(sequelize);
sequelize.sync({
    alter: true
});

const jwt = require('jsonwebtoken');
const sessionCheck = (req, res, next) => {
    if (!req.cookies.session_hash) return res.redirect('/login');
    jwt.verify(req.cookies.session_hash, config.session_secret, (err) => {
        if (err) return res.status(500).render('_error', {
            code: 500,
            message: `Ошибка сессии: <b><%- err.name %></b><br><a href="/logout">Может поможет выход из аккаунта?</a>`
        });
        return next();
    });
};

const Multer = require('multer');
const storage = Multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const fileFilter = (req, file, cb) => {
    if (!config.allowed_mimetypes.includes(file.mimetype))
        return cb(new Error("Разрешена загрузка файлов только PNG, JPG, JPEG и GIF форматов."));

    return cb(null, true);
};

const multer = Multer({
    storage,
    limits: config.limits,
    fileFilter
});
const express = require('express');
const app = express();

app.set('view engine', 'ejs');
app.use(require('cookie-parser')());
app.use('/static', express.static('static'));

app.get('/', [sessionCheck], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    return res.render('index', {
        session
    });
});

app.get('/uploads', [sessionCheck], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    const uploads = await Upload.findAll({
        where: {
            author: session.id
        }
    });

    return res.render('uploads', {
        session,
        uploads
    });
});

app.get('/admin', [sessionCheck], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    if (!session.isAdmin) return res.status(403).render('_error', {
        code: 403,
        message: "Доступ к данной странице ограничен."
    });

    const users = await User.findAll();
    const uploads = await Upload.findAll();
    const invites = await Invite.findAll();
    return res.render('admin', {
        session,
        users,
        uploads,
        invites
    });
});

app.get('/login', async (req, res) => {
    if (req.cookies.session_hash) return res.redirect('/');
    return res.render('login');
});

app.get('/register', async (req, res) => {
    if (req.cookies.session_hash) return res.redirect('/');
    return res.render('register');
});

app.get('/uploads/:code', async (req, res) => {
    let {
        code
    } = req.params;
    const uploads = await Upload.findAll({
        where: {
            code
        }
    });
    if (!uploads.length) return res.status(404).render('_error', {
        code: 404,
        message: "Изображение не найдено."
    });

    return res.sendFile(`${__dirname}/${uploads[0].path}`);
});

app.get('/logout', (req, res) => {
    res.cookie('session_hash', null, {
        maxAge: -1
    });
    return res.redirect('/');
});

app.post('/api/login', [express.json()], async (req, res) => {
    let {
        username,
        password
    } = req.body;
    const users = await User.findAll({
        where: {
            username
        }
    });
    if (!users.length) return res.json({
        ok: false,
        message: "Пользователя с такими данными не существует."
    });

    const realPassword = crypto.decrypt({
        content: users[0].password,
        iv: users[0].iv
    });
    if (password !== realPassword) return res.json({
        ok: false,
        message: "Неверный пароль."
    });

    res.cookie('session_hash', jwt.sign({
        id: users[0].id,
        isAdmin: Boolean(users[0].isAdmin)
    }, config.session_secret), {
        maxAge: 604800000
    });
    return res.json({
        ok: true,
        message: "Успешная авторизация!"
    });
});

app.post('/api/register', [express.json()], async (req, res) => {
    let {
        username,
        password,
        code
    } = req.body;
    if (!username || !password || !code) return res.json({
        ok: false,
        message: "Форма пуста."
    });

    const invites = await Invite.findAll({
        where: {
            code
        }
    });
    if (!invites.length || (invites[0] && !invites[0].uses))
        return res.json({
            ok: false,
            message: "Недействительный инвайт-код."
        });

    const users = await User.findAll({
        where: {
            username
        }
    });
    if (users.length) return res.json({
        ok: false,
        message: "Пользователь с таким именем уже существует."
    });

    const encrypted = crypto.encrypt(Buffer.from(password, 'utf8'));
    const user = User.build({
        username,
        password: encrypted.content,
        iv: encrypted.iv
    });
    user.save();

    invites[0].uses -= 1;
    invites[0].save();

    return res.json({
        ok: true,
        message: "Успешная регистрация!"
    });
});

app.get('/api/uploads/create', (req, res) =>
    res.json({
        "Version": "13.2.1",
        "Name": "image Storage",
        "DestinationType": "ImageUploader",
        "RequestMethod": "POST",
        "RequestURL": `${config.host}/api/uploads/create`,
        "Headers": {
            "cookie": `session_hash=${req.cookies.session_hash || "***"}`
        },
        "Body": "MultipartFormData",
        "FileFormName": "image",
        "URL": "$json:url$"
    })
);

app.post('/api/uploads/create', [sessionCheck], (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    return multer.single('image')(req, res, (err) => {
        if (err) {
            console.error(err.stack);
            if (err instanceof Multer.MulterError)
                return res.json({
                    ok: false,
                    message: "Ошибка при загрузке файла | Multer"
                });
            else
                return res.json({
                    ok: false,
                    message: "Ошибка при загрузке файла | Неизвестно"
                });
        }

        const fileCode = Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
        const upload = Upload.build({
            code: `${fileCode}.${req.file.mimetype.split('/')[1]}`,
            path: req.file.destination + req.file.filename,
            author: session.id
        });
        upload.save();

        return res.json({
            ok: true,
            message: "Файл загружен.",
            upload,
            url: `${config.host}/${req.file.destination + upload.code}`
        });
    });
});

app.post('/api/uploads/list', [sessionCheck], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    const uploads = await Upload.findAll({
        where: {
            author: session.id
        }
    });

    return res.json({
        ok: true,
        message: "Вот список всех ваших загрузок.",
        uploads
    });
});

app.post('/api/uploads/delete', [sessionCheck, express.json()], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);

    let {
        id
    } = req.body;
    if (!id) return res.json({
        ok: false,
        message: "Не указан ID файла"
    });

    const uploads = await Upload.findAll({
        where: {
            id,
            author: session.id
        }
    });
    if (!uploads.length) return res.json({
        ok: false,
        message: "Файла с таким ID не существует."
    });

    uploads[0].destroy();
    return res.json({
        ok: true,
        message: "Файл удалён."
    });
});

app.post('/api/uploads/truncate', [sessionCheck], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);

    const uploads = await Upload.findAll({
        where: {
            author: session.id
        }
    });
    for (let upload of uploads) {
        upload.destroy();
    }

    return res.json({
        ok: true,
        message: "Все ваши файлы были удалены."
    });
});

app.post('/api/invite/list', [sessionCheck], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    if (!session.isAdmin) return res.json({
        ok: false,
        message: "Вы не обладаете привилегиями администратора."
    });

    const invites = await Invite.findAll();
    return res.json({
        ok: true,
        message: "Вот список всех инвайт-кодов.",
        invites
    });
});

app.post('/api/invite/create', [sessionCheck, express.json()], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    if (!session.isAdmin) return res.json({
        ok: false,
        message: "Вы не обладаете привилегиями администратора."
    });

    const invite = Invite.build({
        code: Math.random().toString(36).substr(2, 9),
        uses: Number(req.body.uses) || 1
    });
    invite.save();

    return res.json({
        ok: true,
        message: "Инвайт-код создан.",
        invite
    });
});

app.post('/api/invite/delete', [sessionCheck, express.json()], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    if (!session.isAdmin) return res.json({
        ok: false,
        message: "Вы не обладаете привилегиями администратора."
    });

    let {
        code
    } = req.body;
    if (!code) return res.json({
        ok: false,
        message: "Не указан инвайт-код."
    });

    const invites = await Invite.findAll({
        where: {
            code
        }
    });
    if (!invites.length) return res.json({
        ok: false,
        message: "Недействительный инвайт-код."
    });

    invites[0].destroy();
    return res.json({
        ok: true,
        message: "Инвайт-код удалён."
    });
});

app.post('/api/invite/truncate', [sessionCheck], async (req, res) => {
    const session = jwt.verify(req.cookies.session_hash, config.session_secret);
    if (!session.isAdmin) return res.json({
        ok: false,
        message: "Вы не обладаете привилегиями администратора."
    });

    await Invite.destroy({
        truncate: true
    });
    return res.json({
        ok: true,
        message: "Все инвайт-коды удалены."
    });
});

app.use((req, res, next) =>
    res.status(404).render('_error', {
        code: 404,
        message: "Страница не найдена."
    })
);

app.use((err, req, res, next) => {
    console.error(err.stack);
    return res.status(500).render('_error', {
        code: 500,
        message: "Внутренняя ошибка сервера."
    });
});

app.listen(config.port, () => console.log(`* Listening requests on *:${config.port}..`));
const jwt = require('jsonwebtoken');

module.exports = function verifyToken(req, res, next) {
    if (!req.cookies || !req.cookies.auth_token) {
        return res.json({error: "Отсутсвует токен авторизации"});
    }
    try {
        const token = req.cookies.auth_token;
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        if(!decoded || !decoded.user_id) {
            return res.json({ error: "Некорректный токен авторизации" })
        }
        req.user = decoded;
    } catch (err) {
        return res.json({ error: "Некорректный токен авторизации" })
    }

    return next();
}
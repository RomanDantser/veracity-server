const express = require('express');
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;

const validators = require('./src/validators');
const { dbVeracityClient } = require('./src/db');
const auth = require('./src/auth');

const app = express();
app.use(express.json( {limit: '50mb'}));
app.use(cookieParser());
const corsOptions = {
    origin: process.env.ORIGIN_DEV,
    credentials: true,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }
app.use(cors(corsOptions));


const db = dbVeracityClient();

// Authentication and authorization
app.post('/api/register', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            LDAP,
            department,
            subdivision,
            password
        } = req.body;
    

    const validationResult = validators.validateUserOnRegister(
        firstName,
        lastName,
        LDAP,
        department,
        subdivision,
        password
    );

    if (validationResult.message !== 'OK') {
        return res.send(validationResult);
    }

    const users = db.collection('users');

    const existedUser = await users.findOne({ LDAP });

    if (existedUser) {
        return res.send({error: "Пользователь уже зарегистрирован, попробуйте еще раз"});
    }
    
    const encryptedPassword = await bcrypt.hash(password, 10);
    const user = {
        firstName: firstName,
        lastName: lastName,
        LDAP: LDAP,
        department: subdivision === "Логистика" ? 0 : department,
        subdivision: subdivision,
        password: encryptedPassword
    }

    const userIdObject = await users.insertOne(user);

    if (userIdObject) {
        console.log(`Created User with ID ${userIdObject.insertedId.toString()}`);
        const token = jwt.sign(
            { user_id: userIdObject.insertedId.toString(), LDAP },
            process.env.TOKEN_KEY,
            { expiresIn: '8h' }
        );
        const resultOfTokenSigning = await users.updateOne({ LDAP }, { $set: { token }});
        if (resultOfTokenSigning) {
            res.cookie('auth_token', token, {maxAge: 28800000, httpOnly: true, sameSite: 'none', secure: true})
            return res.status(201).json({
                firstName,
                lastName,
                LDAP,
                subdivision,
                department
            });
        } else {
            throw Error ('Error while signing user token to database')
        }
    } else throw Error('Error while inserting user in database')
    
    }
    catch (e) {
        console.error(e);
        return res.status(500).send({error: "Ошибка сервера"})
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const {
            LDAP,
            password
        } = req.body;

        if(!LDAP || !password || typeof password !== 'string' || typeof LDAP !== 'string') {
            return res.send({error: 'Некорректно введенные данные'})
        }

        const users = db.collection('users');
        const user = await users.findOne({ LDAP });

        if(user && (await bcrypt.compare(password, user.password))) {
            const token = jwt.sign({ user_id: user._id, LDAP }, process.env.TOKEN_KEY, { expiresIn: '8h' });
            const resultOfUpdate = await users.updateOne({ LDAP }, { $set: { token }});
            if(resultOfUpdate) {
                res.cookie('auth_token', token, {maxAge: 28800000, httpOnly: true, sameSite: 'none', secure: true})
                return res.status(200).send({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    LDAP: user.LDAP,
                    subdivision: user.subdivision,
                    department: user.department
                });
            } else throw Error('Error while updating user token')
        }
    }
    catch (e) {
        console.error(e);
        return res.send('Ошибка сервера');
    }

    return res.send({error: "Неверно введены данные о пользователе"})
});

app.get('/api/auth', async (req, res) => {
    if (!req.cookies || !req.cookies.auth_token) {
        return res.json({error: "Отсутсвует токен авторизации"});
    }

    const token = req.cookies.auth_token;
    try {
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        const users = db.collection('users');
        const user = await users.findOne({ LDAP: decoded.LDAP });
        const userData = {
            firstName: user.firstName,
            lastName: user.lastName,
            LDAP: user.LDAP,
            department: user.department,
            subdivision: user.subdivision
        }
        if (user) {
            console.log(`Got an authentication from user with LDAP: ${user.LDAP}`);
            return res.status(200).json(userData)
        }
        
    } catch (err) {
        return res.json({error: "Некорректный токен авторизации"})
    }

});

// Items logic
app.post('/api/create-items', auth, async (req, res) => {
    try {
        const data = req.body;
        const products = db.collection('products');
        for (let item of data) {
            const product = await products.findOne({ _id: new ObjectId(item.productDBId)});
            if (!product) {
                return res.json({ error: "Предоставленные данные некорректны" });
            }
            const validationRes = validators.validateItemOnUpload(item.programQuantity, item.factQuantity, item.comment);
            if (validationRes.error) {
                return res.json(validationRes);
            }
        }
        const itemsToInsert = [];
        const currDate = new Date();
        const expDate = new Date(currDate);
        expDate.setDate(expDate.getDate() + 4);

        for (let item of data) {
            itemsToInsert.push({
                productId: new ObjectId(item.productDBId),
                programQuantity: item.programQuantity,
                factQuantity: item.factQuantity,
                comment: item.comment,
                status: "В работе",
                whoCreated: new ObjectId(req.user.user_id),
                dateOfCreation: currDate,
                dateOfExpiration: expDate
            });
        }
        const items = db.collection('items');
        const resultOfInsertion = await items.insertMany(itemsToInsert);
        if(resultOfInsertion) {
            console.log(`User ${req.user.user_id} created ${itemsToInsert.length} new items`)
            res.json({ message: "ok" })
        }

    } catch (err) {
        console.error(err);
        res.json({ error: "Ошибка сервера при загрузке данных" })
    }
});

app.post('/api/get-one-product', async (req, res) => {
    const {
        productId
    } = req.body;

    const products = db.collection('products');

    const foundProduct = await products.findOne({ id: productId });

    if(foundProduct) {
        return res.json(foundProduct);
    } else {
        return res.json({error: "Артикул не найден"})
    }

});

app.get('/api/get-items', auth, async (req, res) => {
    try {
        const items = db.collection('items');
        const data = await items.aggregate([
            {
               $match: { dateOfExpiration: { $gt: new Date() } } 
            },
            {
                $lookup: {
                    from: "products",
                    localField: "productId",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            {$unwind: "$productInfo"},
            {
                $lookup: {
                    from: "users",
                    pipeline: [
                        {$project: {
                            _id: 0,
                            firstName: 1,
                            lastName: 1,
                        }}
                    ],
                    localField: "whoCreated",
                    foreignField: "_id",
                    as: "whoCreated"
                }
            },
            {$unwind: "$whoCreated"},
            {
               $project: {
                    "productId": 0,
                    "_id": 0
               } 
            }
        ]).toArray();
        res.json(data);


    } catch (err) {
        console.error(err);
        return res.json({error: "Ошибка сервера при получении заявок"})
    }
});

app.post('/api/upload-products', auth, async (req, res) => {
    try {
        const { data } = req.body;
        const products = db.collection('products');
        await products.insertMany(data);
        console.log(`User ${req.user.user_id} uploaded ${data.length} rows of products data`);
        return res.json({ message: 'ok' })

        

    } catch (err) {
        console.error(err);
        return res.json({ error: "Ошибка при загрузке товаров на сервер" })
    }


});

const startOfServer = new Date()
app.listen(process.env.PORT, ()=> {
    console.log(`Server on port ${process.env.PORT} started at ${startOfServer.toLocaleString()}`);
});
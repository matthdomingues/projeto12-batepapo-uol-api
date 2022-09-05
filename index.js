import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI)
let db;
mongoClient.connect().then(() => { db = mongoClient.db("bate_papo") });

const nameSchema = joi.object({ name: joi.string().required() });

const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('private_message', 'message').required(),
    time: joi.string().required()
});

app.post('/participants', async (req, res) => {
    const name = req.body;
    console.log(name);

    const validation = nameSchema.validate(name);

    if (validation.error) {
        return res.sendStatus(422).send(validation.error.details[0].message);
    };

    try {
        const conflict = await db.collection("usuarios").findOne(name);
        console.log(conflict);

        if (conflict === null) {
            db.collection('usuarios').insertOne({ ...name, lastStatus: Date.now() });
            db.collection('mensagens').insertOne({ from: name.name, to: "Todos", text: "Entra na sala...", type: "status", time: dayjs().format('HH:mm:ss') });
            res.sendStatus(201);
        } else {
            return res.sendStatus(409);
        };

    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    };
});

app.get('/participants', (req, res) => {
    db.collection("usuarios").find().toArray().then(data => res.send(data));
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const name = req.headers.user;

    const message = {
        from: name,
        to: to,
        text: text,
        type: type,
        time: dayjs().format('HH:mm:ss')
    };

    const validation = messageSchema.validate(message, { abortEarly: false });

    if (validation.error) {
        return res.sendStatus(422).send(validation.error.map(value => value.message));
    };

    try {
        await db.collection('mensagens').insertOne(message);
        console.log(message)
        return res.sendStatus(201);
    } catch (err) {
        return res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user;

    try {
        const mensagens = await db.collection('mensagens').find().toArray();

        const mensagensFiltradas = mensagens.filter(value => value.to === user || value.to === 'Todos' || value.from === user);

        if (!limit) {
            return res.send(mensagensFiltradas);
        } else {
            return res.send(mensagensFiltradas.slice(limit * -1))
        }

    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;

    const notFound = await db.collection("usuarios").findOne({ name: user });

    try {
        if (notFound === null) {
            return res.sendStatus(404);
        } else {
            db.collection('usuarios').updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
            return res.sendStatus(200);
        }
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    };
});

setInterval(() => {
    db.collection('usuarios').find().toArray().then(absent => {
        absent.forEach(user => {
            if (Date.now() - Number(user.lastStatus) > 15000) {
                db.collection('usuarios').deleteOne(user);
                db.collection('mensagens').insertOne({
                    from: user.name,
                    to: "Todos",
                    text: "Sai da sala...",
                    type: "status",
                    time: dayjs().format('HH:mm:ss')
                });
            }
        });
    });
}, 15000);

app.delete('/messages/:id', async (req, res) => {
    const user = req.headers.user;
    const { id } = req.params;

    try {
        const find = await db.collection("mensagens").findOne({ _id: new ObjectId(id) });
        if (!find || find.length === 0) {
            return res.sendStatus(404);
        }
        if (find[0].from !== user) {
            return res.sendStatus(401);
        }
        else {
            await db.collection('mensagens').deleteOne({ _id: new ObjectId(id) });
            return res.sendStatus(200);
        };
    } catch {
        console.error(err);
        res.sendStatus(500);
    };
});

app.listen(5000, () => { console.log('Tô funcionando na porta 5000!') });
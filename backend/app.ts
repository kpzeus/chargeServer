import express from "express";
import { createClient } from "redis";
import { json } from "body-parser";
import AsyncLock = require('async-lock');

const DEFAULT_BALANCE = 100;

interface ChargeResult {
    isAuthorized: boolean;
    remainingBalance: number;
    charges: number;
}

const connectLock = new AsyncLock();
const chargeLock = new AsyncLock();
let client:any = null;

async function connect(): Promise<ReturnType<typeof createClient>> {
    const url = `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? "6379"}`;
    console.log(`Using redis URL ${url}`);
    
    if(client == null){
        await connectLock.acquire('client', async function() {
            if(client == null){                
                client = createClient({ url });
                await client.connect();
            }
        });
    }

    return client;
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reset(account: string): Promise<void> {
    const client = await connect();
    await client.set(`${account}/balance`, DEFAULT_BALANCE);
}

async function charge(account: string, charges: number): Promise<ChargeResult> {
    const client = await connect();
    let balance = 0;
    let remainingBalance = 0;
    await chargeLock.acquire(account, async function() {
        balance = parseInt((await client.get(`${account}/balance`)) ?? "");
        if (balance >= charges) {
            remainingBalance = balance - charges;
            await client.set(`${account}/balance`, remainingBalance);
        } 
    });   
    if (balance >= charges) {
        return { isAuthorized: true, remainingBalance, charges };
    } else {
        return { isAuthorized: false, remainingBalance: balance, charges: 0 };
    } 
}

export function buildApp(): express.Application {
    const app = express();
    app.use(json());
    app.post("/reset", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            await reset(account);
            console.log(`Successfully reset account ${account}`);
            res.sendStatus(204);
        } catch (e) {
            console.error("Error while resetting account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    app.post("/charge", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            const result = await charge(account, req.body.charges ?? 10);
            console.log(`Successfully charged account ${account}`);
            res.status(200).json(result);
        } catch (e) {
            console.error("Error while charging account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    return app;
}
import { performance } from "perf_hooks";
import supertest from "supertest";
import { buildApp } from "./app";

const app = supertest(buildApp());

async function basicLatencyTest() {
    await app.post("/reset").expect(204);
    const start = performance.now();
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    console.log(`Latency: ${performance.now() - start} ms`);
}

async function negativeBalanceTest() {
    await app
    .post("/reset")
    .send({ account: 'a1' })
    .expect(204);

    let promises: Promise<any>[] = [
    ];

    let i=0;
    while(i < 100){
        promises.push(app
            .post("/charge")
            .send({ account: 'a1', charges: 15 })
            .expect(200));
        i++;
    }

    const results = await Promise.all(promises);

    results.forEach(element => {
        //console.log(`r : ` + JSON.stringify(element.body));
    });

    let result = await app
    .post("/charge")
    .send({ account: 'a1', charges: 15 })
    .expect(200);

    //console.log(`result : ` + JSON.stringify(result.body));

    if(result.body.remainingBalance == 10){
        console.log('Expected balance');
    }
    else{
        console.log('Wrong balance : ' + result.body.remainingBalance);
    }
}

async function runTests() {
    await basicLatencyTest();
    await negativeBalanceTest();
}

runTests().catch(console.error);

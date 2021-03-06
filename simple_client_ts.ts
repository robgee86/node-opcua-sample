import {
    resolveNodeId,
    AttributeIds,
    OPCUAClient,
    ClientSubscription,
    DataValue,
    BrowseResult,
    ReferenceDescription
} from "node-opcua";

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";

const nodeId = resolveNodeId("ns=1;s=Temperature");

async function main() {

    try {

        const client = new OPCUAClient({
            endpoint_must_exist: false,
            connectionStrategy: {
                maxRetry: 2,
                initialDelay: 2000,
                maxDelay: 10 * 1000
            }
        });
        client.on("backoff", () => console.log("retrying connection"));


        await client.connect(endpointUrl);

        const session = await client.createSession();

        const browseResult: BrowseResult = await session.browse("RootFolder") as BrowseResult;

        console.log(browseResult.references.map((r: ReferenceDescription) => r.browseName.toString()).join("\n"));

        const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
        console.log(` temperature = ${dataValue.value.toString()}`);

        // step 5: install a subscription and monitored item
        const subscription = new ClientSubscription(session, {
            requestedPublishingInterval: 1000,
            requestedLifetimeCount: 10,
            requestedMaxKeepAliveCount: 2,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 10
        });

        subscription
            .on("started", () => console.log("subscription started - subscriptionId=", subscription.subscriptionId))
            .on("keepalive", () => console.log("keepalive"))
            .on("terminated", () => console.log("subscription terminated"));

        const monitoredItem = subscription.monitor({
            nodeId,
            attributeId: AttributeIds.Value
        },
            {
                samplingInterval: 100,
                discardOldest: true,
                queueSize: 10
            });


        monitoredItem.on("changed", (dataValue: DataValue) => {
            console.log(` Temperature = ${dataValue.value.value.toString()}`)
        });

        await new Promise((resolve) => setTimeout(resolve, 10000));

        await subscription.terminate();

        console.log(" closing session");
        await session.close();

        await client.disconnect();
    }
    catch (err) {
        console.log("Error !!!", err);
    }
}

main();

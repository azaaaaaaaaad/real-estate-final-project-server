const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fdffxhb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const advertisementCollection = client.db("realEstateDB").collection("advertisement")
        const allPropertiesCollection = client.db("realEstateDB").collection("allProperties")
        const reviewsCollection = client.db("realEstateDB").collection("reviews")


        //all advertisement form db
        app.get('/advertisement', async (req, res) => {
            const result = await advertisementCollection.find().toArray();
            res.send(result)
        })

        app.get('/advertisement/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await advertisementCollection.findOne(query)
            res.send(result)
        })

        //all properties form db
        app.get('/allProperties', async (req, res) => {
            const result = await allPropertiesCollection.find().toArray();
            res.send(result)
        })

        app.get('/allProperties/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await allPropertiesCollection.findOne(query)
            res.send(result)
        })

        //save a property data
        app.post('/property', async (req, res) => {
            const propertyData = req.body
            const result = await allPropertiesCollection.insertOne(propertyData)
            res.send(result)
        })


        //all reviews form db
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('RealEstate is running')
})

app.listen(port, () => {
    console.log(`RealEstate is running on port ${port}`);
})
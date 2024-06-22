const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb');
const express = require('express')
const cors = require('cors');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express();
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 5000;

//middleware
const corsOptions = {
    origin: ['http://localhost:5000', "http://localhost:5173", "https://real-state-server-nine.vercel.app", "https://final-project-12-aead8.web.app"],
    credentials: true,
    optionSuccessStatus: 200
}
app.use(cors(corsOptions));
app.use(express.json())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    console.log(token)
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err)
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
    })
}



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
        const usersCollection = client.db("realEstateDB").collection("users")
        const wishlistCollection = client.db("realEstateDB").collection("wishlist")
        const offerRequestColelction = client.db("realEstateDB").collection("offerRequest")


        // verify admin middleware
        const verifyAdmin = async (req, res, next) => {
            console.log('hello')
            const user = req.user
            const query = { email: user?.email }
            const result = await usersCollection.findOne(query)
            console.log(result?.role)
            if (!result || result?.role !== 'admin')
                return res.status(401).send({ message: 'unauthorized access!!' })

            next()
        }

        // verify agent middleware
        const verifyAgent = async (req, res, next) => {
            console.log('hello')
            const user = req.user
            const query = { email: user?.email }
            const result = await usersCollection.findOne(query)
            console.log(result?.role)
            if (!result || result?.role !== 'agent')
                return res.status(401).send({ message: 'unauthorized access!!' })

            next()
        }

        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })
        // Logout
        app.get('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
                // console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
        })

        //wishlist collection
        app.post('/wishlist', async (req, res) => {
            const wishlist = req.body
            const result = await wishlistCollection.insertOne(wishlist)
            res.send(result)
        })

        app.get('/wishlist', async (req, res) => {
            const email = req.query.email
            const query = { email }
            const result = await wishlistCollection.find(query).toArray()
            // const result = await wishlistCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/wishlist/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await wishlistCollection.findOne(query)
            res.send(result)
        })

        app.delete('/wishlist/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await wishlistCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/offerRequest', async (req, res) => {
            const offerRequest = req.body
            const result = await offerRequestColelction.insertOne(offerRequest)
            res.send(result)
        })



        //get all offer request from db for property owner
        app.get('/offerRequest', async (req, res) => {
            const result = await offerRequestColelction.find().toArray()
            res.send(result)
        })

        // update offer request of property in db
        app.patch('/offerRequest/:id', async (req, res) => {
            const id = req.params.id
            const status = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...status
                }
            }
            const result = await offerRequestColelction.updateOne(query, updateDoc)
            res.send(result)
        })

        // show all sold properties from db
        app.get('/soldProperties', async (req, res) => {
            const query = { status: 'accepted' }
            const result = await offerRequestColelction.find(query).toArray()
            res.send(result)
        })

        //save a user in db
        app.put('/user', async (req, res) => {
            const user = req.body
            console.log(req.body);
            const query = { email: user?.email }
            //check if user already exist in db
            const isExist = await usersCollection.findOne(query)
            if (isExist) {
                //if existing user try to change his role
                if (user.status === 'Requested') {
                    const result = await usersCollection.updateOne(query, {
                        $set: { status: user?.status },
                    })
                    return res.send(result)
                } else {
                    //if existing user login again
                    return res.send(isExist)
                }
            }

            //save user for the first time
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    ...user,
                    Timestamp: Date.now(),
                },
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            console.log(result);
            res.send(result)
        })

        //get a user info by email from db
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email
            const result = await usersCollection.findOne({ email })
            res.send(result)
        })

        // get all users data from db
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        //update a user role
        app.patch('/users/update/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const query = { email }
            const updateDoc = {
                $set: {
                    ...user,
                    timestamp: Date.now()
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        //delete a user
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

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

        app.put('/allProperties/:id', async (req, res) => {
            const property = req.body
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    ...property
                },
            }
            const result = await allPropertiesCollection.updateOne(query, updateDoc, options)
            console.log(result);
            res.send(result)
        })

        //save a property data
        app.post('/property', async (req, res) => {
            const propertyData = req.body
            const result = await allPropertiesCollection.insertOne(propertyData)
            res.send(result)
        })

        // update  property status in db
        app.patch('/property/:id', async (req, res) => {
            const id = req.params.id
            const verification_status = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...verification_status
                }
            }
            const result = await allPropertiesCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        //get all property for agent
        app.get('/my-added-properties/:email', async (req, res) => {
            const email = req.params.email
            let query = { 'agent.email': email }
            const result = await allPropertiesCollection.find(query).toArray();
            res.send(result)
        })

        //delete a property
        app.delete('/my-added-properties/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await allPropertiesCollection.deleteOne(query)
            res.send(result)
        })

        //all reviews form db
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result)
        })

        //post review
        app.post('/reviews', async (req, res) => {
            const reviewData = req.body
            const result = await reviewsCollection.insertOne(reviewData)
            res.send(result)
        })

        app.delete('/reviews/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await reviewsCollection.deleteOne(query)
            res.send(result)
        })

        


        //payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body
            const amount = parseInt(price * 100)

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                paymnet_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
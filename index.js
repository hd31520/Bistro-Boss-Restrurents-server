const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;




// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Bistro BOss Is Running');
})




// const uri = `mongodb+srv://=${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fthvk3c.mongodb.net/?retryWrites=true&w=majority`;


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fthvk3c.mongodb.net/?retryWrites=true&w=majority`;

// const uri = "mongodb://localhost:27017";




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

    const menuCollection = client.db("bistroBoss").collection('menu');
    const reviewsCollection = client.db("bistroBoss").collection('reviews');
    const cartsCollection = client.db("bistroBoss").collection('carts');
    const usersCollection = client.db("bistroBoss").collection('users');
    const paymentsCollection = client.db("bistroBoss").collection('payments');


    // JWT related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' })
      res.send({ token })
    })

    // Middleware 
    const verifyToken = (req, res, next) => {

      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });

      }
      const token = req.headers.authorization.split(' ')[1];
      console.log('inside token', token);

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized Access' });
        }
        req.decoded = decoded;
        next();
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }












    // Users relatited Api
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

      const result = await usersCollection.find().toArray();
      res.send(result);
    })



    app.get('/users/admin/:email', verifyToken, async (req, res, next) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.send(403).send({ message: 'forbidden access' })
      }

      const query = { email: email }

      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin })
    })

    app.post('/users', async (req, res) => {
      const user = req.body;



      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'UserAlready Exists', insertedId: null })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })


    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {

        $set: {

          role: 'admin'

        },

      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })




    // Menu related api
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })




   


    app.get('/menu/:id', async (req,res) => {
      const id = req.params.id;
      const query = {_id: id};
      const result = await menuCollection.findOne(query);
     
      if(result){
        // console.log("inside",result)
        res.send(result);
      }
      else{
        const result1 = await menuCollection.findOne({_id: new ObjectId(id)});
        // console.log("Outside",result1)
        res.send(result1);
      }
      
    })

    app.patch('/menu/:id', async(req, res) => {
      const item = req.body;
      const id = req.params.id;
      const query = {_id: id};
     
      const updateDoc = {
        $set:{
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await menuCollection.updateOne(query, updateDoc);
      if(result){
        console.log(result)
        res.send(result)
      }
      else{
        const filter = {_id: new ObjectId(id)};
        const result1 = await menuCollection.updateOne(filter, updateDoc);
        console.log(result1)
        res.send(result1);
      }
    })


    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result)
    })

    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
     

      if(result.deletedCount > 0){
        res.send(result);
      }
      else{
        const filter = {_id: id};
        const result1 = await menuCollection.deleteOne(filter);
        res.send(result1);
      }
     
      
    })



    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    })

    // Cart
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    })
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      // console.log(cartItem);
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })


    app.post('/create-prement-intent', async(req, res) => {
      const {price} = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // Payment related api

    app.get('/payments/:email',verifyToken,  async (req, res) => {
      const query ={email: req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const result = await paymentsCollection.find(query).toArray();
      res.send(result)
    })

    app.post('/payments', async(req, res) => {
      const payment = req.body;
      const paymentResult = await paymentsCollection.insertOne(payment);
      

      const query = {_id: {
        $in:payment.cartId.map(id => new ObjectId(id))
      }}
      const deleteresult = await cartsCollection.deleteMany(query);
      res.send({paymentResult, deleteresult})

    })


    // stats or analitcs
    app.get('/admin-stats',verifyToken, verifyAdmin, async(req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentsCollection.estimatedDocumentCount();

      const result = await paymentsCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
          }
        }
      ]).toArray();
      const revnue = result.length > 0 ? result[0].totalRevenue : 0; 

     res.send({
        users,
        menuItems,
        orders,
        revnue
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




app.listen(port, () => {
  console.log(`Bistro BOss is sitting on port ${port}`)
})





/** 
 * -----------------------------------
 * NAMING CONVERSION
 * -----------------------------------
 *  app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.put('/users/:id')
 * ap.patch('/users/:id')
 * app.delete('/users/:id')
 * 
 * */

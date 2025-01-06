const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

console.log(process.env.MONGO_URI)

const mongoOptions = { 
  useNewUrlParser: true,
  useUnifiedTopology: true
};
mongoose.connect(process.env.MONGO_URI,mongoOptions)

const userSchema = new mongoose.Schema({
  username: {
    type: String
  },
  log: [{type:mongoose.Schema.Types.ObjectId,ref:'Exercise'}]
},{toJSON:{virtuals:true}});
userSchema.virtual('count').get(function(){
  return this.log.length;
});
const User = mongoose.model('User',userSchema);

const exerciseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  description: {
    type: String
  },
  duration: {
    type: Number
  },
  date: {
    type: Date,
    default: Date.now,
    get: (value)=>(value.toDateString())
  }
},{toJSON:{getters:true}});
const Exercise = mongoose.model('Exercise',exerciseSchema);

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/users',
  bodyParser.urlencoded({extended:false}),
  function(req,res){
    const {username} = req.body;
    const newUser = new User({
      username:username
    });
    newUser
      .save()
      .then(doc=>{
        console.log('new User saved');
        console.log(doc);
        res.json({
          username:doc.username,
          _id:doc.id
        })
      })
      .catch(err=>{
        res.json({
          error: err
        });
      });
  }
);

app.get('/api/users',function(req,res) {
  User
    .find()
    .then((list)=>{
      res.json(list);
    })
    .catch((err)=>{
      res.json({
        error:err
      })
    })
});

app.post('/api/users/:_id/exercises',
  bodyParser.urlencoded({extended:false}),
  async function(req,res) {
    const {_id} = req.params;
    const {description,duration,date} = req.body;
    const user = await User.findById(_id);
    if(!user){
      res.json({
        error: `user ${_id} does not exist`
      });
    };
    const exerciseDoc = {description,duration};
    const newDate = new Date(date);
    if(!isNaN(newDate)){
      exerciseDoc.date = newDate;
    };
    const newExercise = new Exercise(exerciseDoc);
    await newExercise.save();
    console.log('New exercise saved');
    console.log(newExercise.toJSON());
    user.log.push(newExercise);
    await user.save();
    console.log(`User ${user.username} updated`);
    console.log(user.toJSON());
    res.json({
      username: user.username,
      _id: user.id,
      description: newExercise.description,
      duration: newExercise.duration,
      date: newExercise.date
    });
  }
);

app.get('/api/users/:_id/logs',async function(req,res){
  const {_id} = req.params;
  const {from,to,limit} = req.query;
  const populateOptions = {
    path:'log',
    match:{$and:[]},
    select:'-_id',
    options:{}
  };
  if(from){populateOptions.match.$and.push({date:{$gte:new Date(from)}})};
  if(to){populateOptions.match.$and.push({date:{$lte:new Date(to)}})};
  if(limit){populateOptions.options.limit=limit};
  const user = await User
    .findById(_id)
    .populate(populateOptions);
  res.json(user.toJSON());
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

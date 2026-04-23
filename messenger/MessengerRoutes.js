const express = require('express');
const router = express.Router();
const {authentication,googleAuth}=require('../middleware/authMiddleware');
const Conversation =require('./Conversation')
const Message=require('./Message')
const { getIO } = require("../socket");
const io = getIO();
require('../models/Associations');
const multer = require('multer');
const uploadToCloudinary= require('../config/cloudinary')

const storage = multer.memoryStorage();
const upload = multer({ storage });

const User=require('../models/User');


router.post('/create-conversation/client/:expertId',googleAuth,async(req,res)=>{
    try {
        const expertId=req.params.expertId;
        const conversation= await Conversation.findOne({where :{
                client:req.user.id,
                expert:expertId
            }})
        if(conversation){
            res.status(401).send("Conversation already exist")
        }
        const newConv=await Conversation.create({ client:req.user.id, expert:expertId})
        io.to(expertId).emit("newConversation", newConv);
        io.to(req.user.id).emit("newConversation", newConv);

        res.status(200).send({conversation:newConv,message:"Conversation created successfully"})
    }catch (e) {
        res.status(500).send({error: e.message});
    }
})

router.post('/addMessage/expert/:conversationId',authentication, upload.array('files', 10),async(req,res)=>{
    try {
        const expertId=req.user.userId;
        const {message}=req.body;
        const conversationId=req.params.conversationId
        const conversation=await Conversation.findByPk(conversationId)
        if(!expertId) res.status(404).send("Expert not found")
        if(!conversation) res.status(404).send("conversation not found");
        let pictureUrls = [];
        let fileUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file =>
                uploadToCloudinary(file.buffer,file.originalname)
            );
            const results = await Promise.all(uploadPromises);
            results.forEach((result, index) => {
                const mimeType = req.files[index].mimetype;
                if (mimeType.startsWith('image/')) {
                    pictureUrls.push(result.secure_url);
                } else {
                    fileUrls.push(result.secure_url);
                }
            });
        }
        const newMessage = await Message.create({
            conversation: conversationId,
            sender: expertId,
            message: message,
            read: false,
            pictures: pictureUrls,
            files: fileUrls
        });
        io.to(expertId).emit("newMessage", newMessage);
        io.to(conversation.client).emit("newMessage", newMessage);

        res.status(200).json(newMessage)
    }catch (e) {
        res.status(500).json({error: e.message});
    }
})

router.get('/files/expert/:conversationId', authentication, async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        const conversation = await Conversation.findByPk(conversationId);

        if (!conversation) return res.status(404).send("Conversation not found");

        const messages = await Message.findAll({
            where: { conversation: conversationId }
        });

        const allPictures = messages.flatMap(msg => msg.pictures || []);
        const allFiles = messages.flatMap(msg => msg.files || []);

        const cleanUrl = (url) => url.replace('/fl_inline/', '/').replace('/fl_inline', '');
        res.status(200).json({
            pictures: allPictures.map(cleanUrl),
            files: allFiles.map(cleanUrl)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/files/client/:conversationId', googleAuth, async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        const conversation = await Conversation.findByPk(conversationId);

        if (!conversation) res.status(404).send("Conversation not found");

        const messages = await Message.findAll({
            where: { conversation: conversationId }
        });

        const allPictures = messages.flatMap(msg => msg.pictures || []);
        const allFiles = messages.flatMap(msg => msg.files || []);

        res.status(200).json({ pictures: allPictures, files: allFiles });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/addMessage/client/:conversationId',googleAuth,async(req,res)=>{
    try {
        const clientId=req.user.id;
        const conversationId=req.params.conversationId
        const {message}=req.body;
        const conversation=await Conversation.findByPk(conversationId)
        if(!clientId) res.status(404).send("Client not found")
        if(!conversation) res.status(404).send("Conversation not found");
        let pictureUrls = [];
        let fileUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file =>
                uploadToCloudinary(file.buffer,file.originalname)
            );
            const results = await Promise.all(uploadPromises);
            results.forEach((result, index) => {
                const mimeType = req.files[index].mimetype;
                if (mimeType.startsWith('image/')) {
                    pictureUrls.push(result.secure_url);
                } else {
                    fileUrls.push(result.secure_url);
                }
            });
        }
        const newMessage = await Message.create({
            conversation: conversationId,
            sender: clientId,
            message: message,
            read: false,
            pictures: pictureUrls,
            files: fileUrls
        });
        io.to(conversation.expert).emit("newMessage", newMessage);
        io.to(clientId).emit("newMessage", newMessage);
        res.status(200).json(newMessage)
    }catch (e) {
        res.status(500).json({error: e.message});
    }
})

router.get('/conversations/client',googleAuth,async(req,res)=>{
    try {
        const id=req.user.id;
        const conversations=await Conversation.findAll({where:{client:id}});
       res.status(200).send(conversations);
    }catch (e) {
        res.status(404).json({error: e.message});
    }
})
router.get('/conversations/expert',authentication,async(req,res)=>{
    try {
        const id=req.user.userId;
        const conversations=await Conversation.findAll({where:{expert:id},
            include: [{
                model: User,
                as: 'clientData',
                attributes: ['id', 'firstname','lastname', 'email', 'picture']
            }]});
        res.status(200).send({conversations});
    }catch (e) {
        res.status(404).json({error: e.message});
    }
});

router.get('/messages/expert/:conversationId',authentication,async(req,res)=>{
    try {
        const conversationId=req.params.conversationId;
        const messages=await Message.findAll({where:{conversation:conversationId}});
        res.status(200).json(messages)
    }catch (e) {
        res.status(404).json({error: e.message});
    }
})

router.get('/messages/client/:conversationId',googleAuth,async(req,res)=>{
    try {
        const conversationId=req.params.conversationId;
        const messages=await Message.findAll({where:{conversation:conversationId}});
        res.status(200).json(messages)
    }catch (e) {
        res.status(404).json({error: e.message});
    }
})

module.exports = router;

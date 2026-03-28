const express = require('express');
const router = express.Router();
const { authentication,adminAuthorization,googleAuth } = require('../middleware/authMiddleware');
const ExpertProfile=require('./ExpertProfile');
const { fn, col } = require("sequelize");
require('../models/Associations');
const User = require("../models/User");
router.post("/add",adminAuthorization,async (req,res)=>{
    try {
        const {competences,expertId,category,bio,experience,languages,headline,socialLinks}=req.body;

        const profile=await ExpertProfile.create({expert:expertId,competences:competences,category:category,
            bio:bio,experience:experience,languages:languages,headline:headline,socialLinks:socialLinks});
        res.status(200).json({profile});

    }catch (e) {
        res.status(401).send({error:e.message});
    }
})

router.get('/byexpert/:id',authentication,async (req,res)=>{
    try {
        const {id} = req.params;

        const profile=await ExpertProfile.findOne({where :{
                expert:id
            }})
        if(!profile) res.status(404).send({error:"Profile not found"});
        res.status(200).json({profile});
    }catch (e) {
        res.status(401).send({error:e.message});
    }
})

router.get('/client/byexpert/:id',googleAuth,async (req,res)=>{
    try {
        const {id} = req.params;

        const profile=await ExpertProfile.findOne({where :{
                expert:id
            }})
        if(!profile) res.status(404).send({error:"Profile not found"});
        res.status(200).json({profile});
    }catch (e) {
        res.status(401).send({error:e.message});
    }
})


router.get('/categories',authentication, async (req, res) => {
    try {
        const categories = await ExpertProfile.findAll({
            attributes: [
                'category',
                [fn('COUNT', col('id')), 'nb_of_profiles']
            ],
            group: ['category'],
        });

        res.status(200).json(categories);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

router.get('/client/categories',googleAuth, async (req, res) => {
    try {
        const categories = await ExpertProfile.findAll({
            attributes: [
                'category',
                [fn('COUNT', col('id')), 'nb_of_profiles']
            ],
            group: ['category'],
        });

        res.status(200).json(categories);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

router.get('/experts/:category',googleAuth,async (req,res)=>{
    try {
        const category=req.params.category
        const experts = await ExpertProfile.findAll({
            where: { category: category },
            attributes: [],
            include: [
                {
                    model: User,
                    as: "expertUser",
                    attributes: ["id", "firstname","lastname","picture","role", "email"]
                }
            ]
        });
        res.status(200).json(experts)

    }catch (e) {
        res.status(500).send({error:e.message});
    }
})

router.get('/experts',googleAuth,async (req,res)=>{
    try {
        const experts = await ExpertProfile.findAll({
            attributes: [],
            include: [
                {
                    model: User,
                    as: "expertUser",
                    attributes: ["id", "firstname","lastname","picture","role", "email"]
                }
            ]
        });
        res.status(200).json(experts)

    }catch (e) {
        res.status(500).send({error:e.message});
    }
})

router.put("/myprofile",authentication, async (req, res) => {
    try {
        const  id= req.user.userId;
        console.log("aya wenek ay "+id);

        const { competences, category, bio, experience, languages, headline, socialLinks } = req.body;

        const profile=await ExpertProfile.findOne({where :{
                expert:id
            }})
        if (!profile) {
            return res.status(404).json({ error: "Expert profile not found" });
        }

        await profile.update({
            competences: competences !== undefined ? competences : profile.competences,
            category: category !== undefined ? category : profile.category,
            bio: bio !== undefined ? bio : profile.bio,
            experience: experience !== undefined ? experience : profile.experience,
            languages: languages !== undefined ? languages : profile.languages,
            headline: headline !== undefined ? headline : profile.headline,
            socialLinks: socialLinks !== undefined ? socialLinks : profile.socialLinks
        });

        res.status(200).json({ profile });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

router.put("/:id",adminAuthorization, async (req, res) => {
    try {
        const { id } = req.params;
        const { competences, category, bio, experience, languages, headline, socialLinks } = req.body;

        const profile = await ExpertProfile.findByPk(id);

        if (!profile) {
            return res.status(404).json({ error: "Expert profile not found" });
        }

        await profile.update({
            competences: competences !== undefined ? competences : profile.competences,
            category: category !== undefined ? category : profile.category,
            bio: bio !== undefined ? bio : profile.bio,
            experience: experience !== undefined ? experience : profile.experience,
            languages: languages !== undefined ? languages : profile.languages,
            headline: headline !== undefined ? headline : profile.headline,
            socialLinks: socialLinks !== undefined ? socialLinks : profile.socialLinks
        });

        res.status(200).json({ profile });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});


router.get('/myprofile',authentication,async (req,res)=>{
    try {
        const  id= req.user.userId;
        const profile=await ExpertProfile.findOne({where :{
                expert:id
            }})
        if(!profile) res.status(404).send({error:"Profile not found"});
        res.status(200).json({profile});
    }catch (e) {
        res.status(401).send({error:e.message});
    }
})

router.patch("/categories",adminAuthorization, async (req, res) => {
    try {
        const { category, nameUpdated } = req.body;

        if (!category || !nameUpdated) {
            return res.status(400).send({
                error: "Les paramètres 'category' et 'nameUpdated' sont requis"
            });
        }

        const [updatedCount] = await ExpertProfile.update(
            { category: nameUpdated },
            {
                where: { category: category },
                returning: true
            }
        );

        if (updatedCount === 0) {
            return res.status(404).send({
                message: "Aucun profil trouvé avec cette catégorie"
            });
        }

        res.status(200).send({
            message: "Nom de catégorie mis à jour avec succès",
            updatedCount: updatedCount
        });

    } catch (e) {
        console.error("Error updating category:", e);
        res.status(500).send({ error: e.message });
    }
});
module.exports = router;
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User=require("../models/User");
const ExpertProfile = sequelize.define("ExpertProfile", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    expert:{
        type: DataTypes.UUID,
        allowNull: false,
        unique:true,
        references: {
            model: 'Users',
            key: 'id'
        },
        validate:{
            async isUserExpert(value) {
                const user = await User.findByPk(value);
                if (!user) {
                    throw new Error('User not found');
                }
                if (user.role !== 'expert') {
                    throw new Error('Only users with EXPERT role can be assigned as expert');
                }
                return true;
            }
        }
    },
    category:{type:DataTypes.STRING, allowNull:true},
    bio:{type:DataTypes.STRING, allowNull:true},
    experience:{type:DataTypes.INTEGER, defaultValue:10},
    headline:{type:DataTypes.STRING, allowNull:true},
    languages: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true
    },
    socialLinks: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true
    },
    competences: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true
    },

})
module.exports = ExpertProfile;
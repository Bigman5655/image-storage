const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Invite', {
    code: {
        type: DataTypes.STRING,
        allowNull: false
    },
    uses: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    }
}, {
    tableName: "invites"
});
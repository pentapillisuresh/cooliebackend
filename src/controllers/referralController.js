const { User, Referral, sequelize } = require('../models');

// This function is called when a referred user completes their first booking
exports.completeReferral = async (referredUserId) => {
    const t = await sequelize.transaction();
    try {
        const referral = await Referral.findOne({
            where: { referredId: referredUserId, status: 'pending' },
            transaction: t,
            lock: t.LOCK.UPDATE // 🔒 Prevents double-crediting
        });

        if (!referral) {
            await t.rollback();
            return; // No pending referral found
        }

        // 1. Mark referral as completed
        await referral.update({ status: 'completed' }, { transaction: t });

        // 2. Credit the referrer's wallet
        await User.increment('wallet', {
            by: referral.rewardAmount,
            where: { id: referral.referrerId },
            transaction: t
        });

        await t.commit();
        console.log(`✅ Credited ₹${referral.rewardAmount} to User ${referral.referrerId}`);
    } catch (error) {
        await t.rollback();
        console.error('Referral credit failed:', error);
    }
};

// Endpoint to create a referral record when a new user signs up
exports.createReferral = async (req, res) => {
    try {
        const { referrerId, referredId } = req.body;
        if (referrerId === referredId) return res.status(400).json({ error: 'Self-referral not allowed' });

        await Referral.create({ referrerId, referredId, status: 'pending' });
        res.status(201).json({ success: true, message: 'Referral tracked' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to track referral' });
    }
};
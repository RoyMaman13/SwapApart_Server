const express = require('express');
const router = express.Router();
const Swipe = require('../../models/Swipe');
const auth = require('../../middleware/auth');
const Plan = require('../../models/Plan');
const Match = require('../../models/Match');

// Middleware function to get a specific swipe by ID
async function getSwipe(req, res, next) {
    try {
        const swipe = await Swipe.findById(req.params.id);
        if (swipe == null) {
            return res.status(404).json({ message: 'Cannot find swipe' });
        }
        res.swipe = swipe;
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Function that find all the Plans that have a match with the planId.
const findAllMatchesPlans = async (planId) => {
    try {
        // Find all swipes where the given plan was swiped right and store the swiped plan IDs
        const swipedPlanIds = await Swipe.find({ swiperPlan: planId, isLiked: true })
            .distinct('swipedPlan');
        // Find all swipes where the given plan was swiped left and the swiped plan also swiped right
        const matchPlanIds = await Swipe.find({ swiperPlan: { $in: swipedPlanIds }, swipedPlan: planId, isLiked: true })
            .distinct('swiperPlan');
        // Find all plans that have a match with the given plan
        const matchPlans = await Plan.find({ _id: { $in: matchPlanIds } });
        return matchPlans;
    } catch (error) {
        console.log(error);
    }
};

// Create new matchs between plans if there isn't exist one.
const createNewMatch = async (planId, matchPlans) => {
    try {
        for (let i = 0; i < matchPlans.length; i++) {
            const matchPlan = matchPlans[i];
            const match = await Match.findOne({
                plans: { $all: [planId, matchPlan._id] }
            });
            if (!match) {
                const newMatch = new Match({
                    plans: [planId, matchPlan._id],
                    lastMessage: null, // set lastMessage to null
                    messages: [] // set messages to an empty array
                });
                // Save the new match to the database
                const savedMatch = await newMatch.save();
                // Update the associated plans with the savedMatch ID
                savedMatch.plans.forEach(async (p) => {
                    const plan = await Plan.findById(p);
                    if (!plan) {
                        throw new Error('Plan not found');
                    }
                    plan.matchs.push(savedMatch._id);
                    await plan.save();
                });
                return savedMatch;
            }
        }
    } catch (err) {
        throw new Error(err.message);
    }
};


// GET all swipes
router.get('/', auth, async (req, res) => {
    try {
        const swipes = await Swipe.find();
        res.json(swipes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET a specific swipe by ID
router.get('/:id', auth, getSwipe, (req, res) => {
    res.json(res.swipe);
});

// CREATE a new swipe
router.post('/', auth, async (req, res) => {
    const swipe = new Swipe({
        swiperPlan: req.body.swiperPlan,
        swipedPlan: req.body.swipedPlan,
        isLiked: req.body.isLiked
    });
    try {
        const newSwipe = await swipe.save();
        const newMatchPlans = await findAllMatchesPlans(req.body.swiperPlan);
        const savedMatch = await createNewMatch(req.body.swiperPlan, newMatchPlans);
        res.status(201).json(newSwipe);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a swipe
router.patch('/:id', getSwipe, async (req, res) => {
    if (req.body.swiperPlan != null) {
        res.swipe.swiperPlan = req.body.swiperPlan;
    }
    if (req.body.swipedPlan != null) {
        res.swipe.swipedPlan = req.body.swipedPlan;
    }
    if (req.body.isLiked != null) {
        res.swipe.isLiked = req.body.isLiked;
    }

    try {
        const updatedSwipe = await res.swipe.save();
        res.json(updatedSwipe);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a swipe
router.delete('/:id', getSwipe, async (req, res) => {
    try {
        await res.swipe.remove();
        res.json({ message: 'Swipe deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



module.exports = router;

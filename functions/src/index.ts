/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// Scheduled function to run at 3 AM every Monday
export const resetCommunityGoalsAndUpdateStreak = functions.scheduler.onSchedule(
    {
        schedule: "every monday 03:00",
        timeZone: "America/New_York", // Adjust timezone as needed
    },
    async () => {
        console.log("Starting resetCommunityGoalsAndUpdateStreak batch job...");

        try {
            // Query all communities
            const communitiesSnapshot = await db.collection("communities").get();

            if (communitiesSnapshot.empty) {
                console.log("No communities found.");
                return;
            }

            // Process each community
            const batchPromises = communitiesSnapshot.docs.map(async (communityDoc) => {
                const communityID = communityDoc.id;

                // Query all goals for this community
                const goalsSnapshot = await db
                    .collection("goals")
                    .where("communityID", "==", communityID)
                    .get();

                if (goalsSnapshot.empty) {
                    console.log(`No goals found for community ${communityID}`);
                    return;
                }

                // Determine if all goals are complete
                const allGoalsComplete = goalsSnapshot.docs.every((goalDoc) => {
                    const goal = goalDoc.data();
                    return goal.stepsCompleted === goal.steps;
                });

                const batch = db.batch();

                // Update community streak based on goal completion
                const communityRef = db.collection("communities").doc(communityID);
                if (allGoalsComplete) {
                    batch.update(communityRef, {
                        streak: admin.firestore.FieldValue.increment(1), // Increment streak
                    });
                } else {
                    batch.update(communityRef, {
                        streak: 0, // Reset streak
                    });
                }


                // Reset stepsCompleted for each goal
                goalsSnapshot.forEach((goalDoc) => {
                    batch.update(goalDoc.ref, { stepsCompleted: 0 });
                });

                // Commit batch update
                return batch.commit().then(() => {
                    console.log(`Updated streak and reset goals for community ${communityID}`);
                });
            });

            // Wait for all communities to be processed
            await Promise.all(batchPromises);

            console.log("resetCommunityGoalsAndUpdateStreak batch job completed successfully!");
        } catch (error) {
            console.error("Error resetting community goals or updating streaks:", error);
        }
    }
);

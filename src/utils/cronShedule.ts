import cron from "node-cron";
import { LessThan } from "typeorm";
import { User } from "../entities/user.entity";
import { AppDataSource } from "./data-source";

// Schedule the cron job to run daily
cron.schedule("0 0 * * *", async () => {
  const userRepository = AppDataSource.getRepository(User);

  // Get all users whose deletionScheduledAt date has passed
  const usersToDelete = await userRepository.find({
    where: {
      deletionScheduledAt: LessThan(new Date()), // TypeORM's LessThan function
    },
  });
//console.log("deleted one user for this controller")
//console.log("deleted the user for this controller");
//if(usersToDlete.length>0)
//{if you remove.length>0) then the usersToDelete is 0 console.log(`Deleted length users`)

//}
  if (usersToDelete.length > 0) {
    // Hard delete these users
    await userRepository.remove(usersToDelete);
    console.log(`Deleted ${usersToDelete.length} users`);
  }
});

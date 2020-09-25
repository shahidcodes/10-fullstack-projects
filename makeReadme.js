const fs = require("fs");
const path = require("path");

let projects = fs.readdirSync("./projects");
projects = projects.sort((a, b) => {
  const [aNumber] = a.split(".");
  const [bNumber] = b.split(".");
  return aNumber - bNumber;
});
let readme = `# 10 Full Stack Projects
This contains list of full stack projects that you can build today. 

### How to use list ?
List contains description of each project in form of user story. You need to pick a project and start working on each user story.   
For Example -  
In voting app first you will create a basic project in your favourite framework. Then first user story is tells us to build a login registration feature in the app so we build that.Then next user story tells us to create a list or grid of polls which user will see upon opening the website. But for this you will first need to build the create poll feature which is in later user story.   
I hope now it is clear how to use the list. If any questions let me know.

`;

for (let i = 0; i < projects.length; i++) {
  const fileName = projects[i];
  const filePath = path.resolve(__dirname, "projects", fileName);
  const projectDescription = fs.readFileSync(filePath, { encoding: "utf-8" });
  readme += projectDescription + "\n";
}

fs.writeFileSync("README.md", readme);

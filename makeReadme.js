const fs = require("fs");
const path = require("path");

let projects = fs.readdirSync("./projects");
projects = projects.sort((a, b) => {
  const [aNumber] = a.split(".");
  const [bNumber] = b.split(".");
  return aNumber - bNumber;
});
let readme = `# 100 NodeJs Projects (in-progress)

The goal is to collect at least 100 full stack projects available on various websites.

# Projects (${projects.length}/100)

`;

for (let i = 0; i < projects.length; i++) {
  const fileName = projects[i];
  const filePath = path.resolve(__dirname, "projects", fileName);
  const projectDescription = fs.readFileSync(filePath, { encoding: "utf-8" });
  readme += projectDescription + "\n";
}

fs.writeFileSync("README.md", readme);

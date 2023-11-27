const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const os = require('os');

let config = JSON.parse(fs.readFileSync("./config.json"));

const projDir = path.join(__dirname, 'temp');
for(let file of fs.readdirSync(projDir)) fs.unlinkSync(path.join(projDir, file));
const classesPath = path.join(__dirname, '..', 'force-app', 'main', 'default', 'classes');

if(!config.ram) {
    config.ram = Math.floor(os.totalmem()/100000000) - 1;
} else {
    try {
        parseInt(config.timeout);
    } catch (e) {
        console.log('Please specify an integer value for ram in the config.json file.');
        process.exit(0);
    }
}
if(!config.start_file) {
    config.start_file = classes[0];
} else if(!fs.existsSync(path.join(classesPath, config.start_file))){
    console.log('Please specify a valid start file in the config.json file.');
    process.exit(0);
}
if(!config.end_file) {
    config.end_file = classes[classes.length-1];
} else if(!fs.existsSync(path.join(classesPath, config.end_file))){
    console.log('Please specify a valid end file in the config.json file.');
    process.exit(0);
}
if(!config.timeout) { 
    config.timeout = '900000'; 
} else {
    try {
        parseInt(config.timeout);
    } catch (e) {
        console.log('Please specify an integer value for timeout duration (in milliseconds) in the config.json file.');
        process.exit(0);
    }
}
if(!config.csv_output_folder) {
    console.log('Please specify the output folder for csv in the config.json file.');
    process.exit(0);
} else if(!fs.existsSync(config.csv_output_folder)){
    console.log('Please specify a valid csv output folder in the config.json file.');
    process.exit(0);
}

fs.writeFileSync(path.join(__dirname, '..', 'Success.csv'), '"Problem","Severity","File","Line","Column","Rule","Description","URL","Category","Engine"\n');
fs.writeFileSync(path.join(__dirname, '..', 'Error.csv'), '"Problem","Severity","File","Line","Column","Rule","Description","URL","Category","Engine"\n');

const classes = fs.readdirSync(classesPath).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
});

let flag = false;

for(let file of classes) {
    if(!file.endsWith('.cls')) continue;
    if(file.startsWith(config.start_file) && file.endsWith(config.start_file)) flag = true;
    if(!flag) continue;
    if(file.startsWith(config.end_file) && file.endsWith(config.end_file)) flag = false;

    let filepath = path.join(projDir, file);
    let csvpath = `${config.csv_output_folder}/${file.replace('.cls', '.csv')}`;
    fs.copyFileSync(path.join(classesPath, file), filepath);
    try {
        
        console.clear();
        console.log(`${new Date().toLocaleString()}: Scanning ${file}`);
        console.log(`Command:\nsfdx scanner:run:dfa -f csv -o "${csvpath}" -t "${filepath.toString()}" -p "${projDir.toString()}" --rule-thread-timeout="${config.timeout}" --sfgejvmargs="-Xmx${config.ram}g" --category="Security"`);
        execSync(`sfdx scanner:run:dfa -f csv -o "${csvpath}" -t "${filepath.toString()}" -p "${projDir.toString()}" --rule-thread-timeout="${config.timeout}" --sfgejvmargs="-Xmx${config.ram}g" --category="Security"`);
        let csvcontents = fs.readFileSync(csvpath).toString().trim().split('\n');
        csvcontents.shift();
        for(let line of csvcontents) {
            if(line.includes('LimitReached') || line.includes('Path evaluation timed out')) {
                fs.appendFileSync(path.join(__dirname, '..', 'Error.csv'), line+'\n');
            } else {
                fs.appendFileSync(path.join(__dirname, '..', 'Success.csv'), line+'\n');
            }
        }
    } catch (e) {
        console.log(e.toString());
    } 

    fs.unlinkSync(filepath);
    
}

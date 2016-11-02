/**
 * Created by phatn on 10/30/2016.
 */
var helperFunctions = require("HelperFunctions");
var moveTask = require("task.move");
var roomData = require("RoomDat");

var NEEDED_CREEPS = 4;
var MAX_REPAIR_HITS = 100000;

var TASK_HARVEST = "TASK_HARVEST";
var TASK_UPGRADING = "TASK_UPGRADING";
var TASK_REPAIR = "TASK_REPAIR";
var TASK_BUILD = "TASK_BUILD";
var TASK_DEPOSIT = "TASK_DEPOSIT";

var TYPE_STORAGE = "TYPE_STORAGE";
var TYPE_SOURCE = "TYPE_SOURCE";

var GENERIC_BODIES = [{
    body:[MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY],
    energy:800
},{
    body:[MOVE, MOVE, WORK, WORK, WORK, CARRY],
    energy:450
},{
    body:[MOVE,MOVE,WORK,CARRY,CARRY],
    energy:300
}];


var tasks = {
};
tasks[TASK_HARVEST] = {
    init: function(creep) {
        creep.memory.subrole = TASK_HARVEST;

        var roomSources = _.shuffle(roomData.getEnergySources(creep.room));
        var sourceToUse = roomSources[0];

        if(sourceToUse.storage.length) {
            creep.memory.harvestId = sourceToUse.storage[0].id;
            creep.memory.harvestType = TYPE_STORAGE;
        } else {
            creep.memory.harvestId = sourceToUse.id;
            creep.memory.harvestType = TYPE_SOURCE;
        }
    },

    run: function (creep){
        if(creep.carry.energy < creep.carryCapacity) {
            var source = Game.getObjectById(creep.memory.harvestId);
            if(!source) {
                console.log("Creep with TASK_HARVEST did not have source: " + JSON.stringify(addRoomData(creep.room)));
                tasks[TASK_HARVEST].init(creep);
                return;
            }

            if(creep.memory.harvestType === TYPE_STORAGE) {
                var harvestObj = Game.getObjectById(creep.memory.harvestId);
                if(!harvestObj) {
                    console.log("Harvest storage missing!");
                    tasks[TASK_HARVEST].init(creep);
                    return;
                }

                if(creep.withdraw(harvestObj, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE){
                    moveTask(creep, harvestObj.pos);
                }
            } else {
                if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    moveTask(creep, source.pos);
                }
            }
        }
        else {
            creep.memory.subrole = undefined;
            return true; // Done with task
        }
    },
    count: 0
};

tasks[TASK_UPGRADING] = {
    init: function (creep) {
        creep.memory.subrole = TASK_UPGRADING;
    },
    run: function (creep) {
        if(creep.carry.energy === 0){
            creep.memory.subrole = undefined;
            return true; // Done with task
        } else if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            moveTask(creep, creep.room.controller.pos, creep.room.controller.ticksToDowngrade < 2500);
        }
    },
    count: 0
};

tasks[TASK_REPAIR] = {
    init: function (creep) {
        creep.memory.subrole = TASK_REPAIR;
    },
    run: function (creep) {
        var repairObj = Game.getObjectById(Memory.needsRepair[0]);

        if(!repairObj || creep.carry.energy == 0) {
            creep.memory.subrole = undefined;
            return true; // Done with task
        } else {
            if (creep.repair(repairObj) == ERR_NOT_IN_RANGE) {
                creep.moveTo(repairObj);
            }
        }
    },
    count: 0
};

// Higher is more important
var buildingPriority = {};
buildingPriority[STRUCTURE_EXTENSION] = 10;
buildingPriority[STRUCTURE_TOWER] = 9;
buildingPriority[STRUCTURE_WALL] = 8;
buildingPriority[STRUCTURE_RAMPART] = 7;
buildingPriority[STRUCTURE_ROAD] = 6;
buildingPriority[STRUCTURE_CONTAINER] = 2;


tasks[TASK_BUILD] = {
    findHighestPriority: function(constructionList) {
        if(!constructionList.length) {
            return undefined;
        }

        var highest = {
            val: constructionList[0],
            priority: buildingPriority[constructionList[0].structureType] || -1000
        };

        _.each(constructionList, function(object){
            if(buildingPriority[object.structureType] > highest.priority) {
                highest.val = object;
                highest.priority = buildingPriority[object.structureType];
            }
        });

        return highest.val;
    },
    init: function(creep) {
        creep.memory.subrole = TASK_BUILD;
    },
    run: function (creep){
        var target = Game.getObjectById(Memory.highestPriorityConstructionId);
        if(target && target instanceof ConstructionSite && creep.carry.energy > 0) {
            if(creep.build(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        } else {
            if(!target || !(target instanceof ConstructionSite)){
                Memory.highestPriorityConstructionId = undefined;
            }

            creep.memory.subrole = undefined;
            return true; // Done with task
        }
    },
    count: 0
};

tasks[TASK_DEPOSIT] = {
    init: function (creep) {
        creep.memory.subrole = TASK_DEPOSIT;
    },
    run: function (creep){
        var targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                    structure.energy < structure.energyCapacity;
            }
        });

        if(targets.length > 0) {
            if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                moveTask(creep, targets[0].pos, false, false, false);
            }
        } else {
            creep.memory.subrole = undefined;
            return true; // Done with task
        }

        if(creep.carry.energy == 0) {
            creep.memory.subrole = undefined;
            return true; // Done with task
        }
    },
    count: 0
};

// Focus on building first, then upgrading
// Keep spawner filled first, then repair

/*
Task should be sticky - don't stop upgrading once started


Move to task
Start Task
Harvest -> choose task

pull out creeps to meet minimum upgrade
pull out creeps to meet minimum repair

if spawn needs
- make sure there are minimum number of tasked creeps

if construction
- assign creeps to random construction jobs

assign more to repair
assign rest to upgrade

 */

function findTask(creep) {
    if(creep.carry.energy == 0) {
        return TASK_HARVEST;
    }

    if(creep.room.controller.ticksToDowngrade < 1000 && tasks[TASK_UPGRADING].count < 1) {
        return TASK_UPGRADING;
    }

    if(creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
        var neededEnergy = creep.room.energyCapacityAvailable - creep.room.energyAvailable;
        var inRoute = creep.carryCapacity * tasks[TASK_DEPOSIT].count;

        if(creep.room.energyAvailable + inRoute < creep.room.energyCapacityAvailable){
            return TASK_DEPOSIT;
        }
    }

    if(Memory.needsRepair.length > tasks[TASK_REPAIR].count) {
        return TASK_REPAIR;
    }

    if(Memory.highestPriorityConstructionId) {
        return TASK_BUILD;
    }

    return TASK_UPGRADING;
}

module.exports = {
    role: 'GenericWorkerCreep',
    run: function(creeps) {
        // Create more creeps
        if(creeps.length < NEEDED_CREEPS) {
            var newName = Game.spawns['Spawn1'].createCreep(helperFunctions.findBestBody(Game.spawns['Spawn1'].room, GENERIC_BODIES), undefined, {role: 'GenericWorkerCreep'});
            console.log('Spawning new generic: ' + newName);
        }

        // Build lists
        var spawnStorageList = [],
            repairList = [];
        _.each(Game.spawns['Spawn1'].room.find(FIND_STRUCTURES), function (object) {
           if((object.structureType == STRUCTURE_EXTENSION || object.structureType == STRUCTURE_SPAWN) && object.energy < object.energyCapacity) {
               spawnStorageList.push(object);
           } else if(object.hits < object.hitsMax / 2.5 && object.hits < MAX_REPAIR_HITS) {
               repairList.push(object);
           }
        });

        var controller = Game.spawns['Spawn1'].room.controller;

        if(Game.time % 11 === 0) {
            console.log("Recalc construction list");
            var constructionList = Game.spawns['Spawn1'].room.find(FIND_MY_CONSTRUCTION_SITES);
            var highestPriorityObject = tasks[TASK_BUILD].findHighestPriority(constructionList);

            if(highestPriorityObject){
                Memory.highestPriorityConstructionId = highestPriorityObject.id;
            } else {
                Memory.highestPriorityConstructionId = undefined;
            }
        }


        var repairList = _.sortBy(repairList, ['hits']);
        var repairList = _.map(repairList, function(object) {
            return object.id;
        });
        Memory.needsRepair = _.union(Memory.needsRepair, repairList);

        var repairObj = Game.getObjectById(Memory.needsRepair[0]);
        while(Memory.needsRepair.length > 0 && (!repairObj || repairObj.hits === repairObj.hitsMax || repairObj.hits > MAX_REPAIR_HITS)) {
            Memory.needsRepair.pop();
            repairObj = Game.getObjectById(Memory.needsRepair[0]);
        }

        tasks[TASK_HARVEST].count = 0;
        tasks[TASK_DEPOSIT].count = 0;
        tasks[TASK_UPGRADING].count = 0;
        tasks[TASK_REPAIR].count = 0;
        tasks[TASK_BUILD].count = 0;

        // Handle creeps
        var untaskedCreeps = [];
        _.each(creeps, function (creep) {
            var subrole = creep.memory.subrole;

            if(subrole) {
                if(tasks[subrole].run(creep)){
                    untaskedCreeps.push(creep);
                } else {
                    tasks[subrole].count++;
                }
            } else {
                untaskedCreeps.push(creep);
            }
        });

        // Assign jobs
        _.each(untaskedCreeps, function(creep) {
            var subrole = findTask(creep);

            tasks[subrole].count++;
            tasks[subrole].init(creep);
            tasks[subrole].run(creep);

            creep.say(subrole);
        });
    }
}
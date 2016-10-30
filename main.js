var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRepair = require('role.repair');
var longRangeHarvester = require('LongRangeHarvester');
var roleAttacker = require('attacker');

module.exports.loop = function () {
    var originalRepairLen = Memory.needsRepair.length;
	// Old memory cleanup
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
			console.log('Clearing non-existing creep memory:', name);
        }
    }
	
	longRangeHarvester.manageLongRangeCreeps();

    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
    if(harvesters.length < 3) {
        var newName = Game.spawns['Spawn1'].createCreep([MOVE,MOVE,WORK,WORK,WORK,CARRY], undefined, {role: 'harvester'});
        console.log('Spawning new harvester: ' + newName);
    }
    
    var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    if(upgraders.length < 3) {
        var newName = Game.spawns['Spawn1'].createCreep([MOVE,MOVE,WORK,WORK,WORK,CARRY], undefined, {role: 'upgrader'});
        console.log('Spawning new upgrader: ' + newName);
    }

    var attackers = _.filter(Game.creeps, (creep) => creep.memory.role == 'attacker');
    if(attackers.length < 2) {
        var newName = Game.spawns['Spawn1'].createCreep([MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK], undefined, {role: 'attacker'});
        console.log('Spawning new attacker: ' + newName);
    }

    var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
    if(builders.length < 2) {
        var newName = Game.spawns['Spawn1'].createCreep([MOVE,MOVE,WORK,WORK,WORK,CARRY], undefined, {role: 'builder'});
        console.log('Spawning new builder: ' + newName);
    }

    // Check if spawn needs refilling first
    var energyStorage = Game.spawns['Spawn1'].room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                structure.energy < structure.energyCapacity;
        }
    });
    var constructionList = Game.spawns['Spawn1'].room.find(FIND_CONSTRUCTION_SITES);

    if(Game.time % 100 === 0) {
        var repairList = _.map(Game.spawns['Spawn1'].room.find(FIND_STRUCTURES, {
            filter: function (object) {
                return (object.hits < object.hitsMax / 2.5);
            }
        }), function (object) {
            return object.id;
        });
        Memory.needsRepair = _.union(Memory.needsRepair, repairList);
    }


    var source = 0;
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            if(energyStorage.length) {
                roleHarvester.run(creep, source);
                source = 1;
            } else if(Memory.needsRepair.length) {
                roleRepair.run(creep);
            } else if(constructionList.length) {
                roleBuilder.run(creep, constructionList);
            } else {
                roleUpgrader.run(creep);
            }
        }
        if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep, constructionList);
        }
        if(creep.memory.role == 'attacker') {
            roleAttacker.run(creep);
        }
    }

    if(originalRepairLen !== Memory.needsRepair.length)
        console.log("Structures needing repair: "+Memory.needsRepair.length);
}
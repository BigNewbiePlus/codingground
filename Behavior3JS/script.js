//NODE STATES ==================================================================
var SUCCESS = 1;
var FAILURE = 2;
var RUNNING = 3;
var ERROR   = 4;

//GLOBAL & UTILITY FUNCTIONS ===================================================
var createUUID = function(){
    var s = [];
    var hexDigits = '0123456789abcdef';
    for(var i=0;i< 36;i++){
        s[i]=hexDigits.substr(Math.floor(Math.random()* 0x10), 1);
    }
    
    //bits 12-15 of the time_hi_and_version field to 0010
    s[14] = "4";
    
    //bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
    
    s[8] = s[13] = s[18] = s[23] = '-';
    
    var uuid = s.join("");
    
    return uuid;
};

var Blackboard = function(){
    this.initialize();
};

Blackboard.prototype.initialize = function(){
    this._baseMemory = {}; //used to store global information
    this._treeMemory = {}; //used to store tree and node informaton
};

Blackboard.prototype._getTreeMemory = function(treeScope){
    if(!this._treeMemory[treeScope]){
        this._treeMemory[treeScope] = {
            'nodeMemory' : {},
            'openNodes'  : [],
        };
    }
    
    return this._treeMemory[treeScope];
};

Blackboard.prototype._getNodeMemory = function(treeMemory, nodeScope){
    var memory = treeMemory['nodeMemory'];
    if(!memory[nodeScope]){
        memory[nodeScope] = {};
    }
    
    return memory[nodeScope];
};

Blackboard.prototype._getMemory = function(treeScope, nodeScope){
    var memory = this._baseMemory;
    
    if(treeScope){
      
        memory = this._getTreeMemory(treeScope);
        
        if(nodeScope){
          
            memory = this._getNodeMemory(memory, nodeScope);
           
        }
    }
    return memory;
};

Blackboard.prototype.set = function(key, value, treeScope, nodeScope){
    var memory = this._getMemory(treeScope, nodeScope);
    memory[key]=value;
};

Blackboard.prototype.get = function(key,treeScope, nodeScope){
    var memory = this._getMemory(treeScope, nodeScope);
    return memory[key];
};

var Tick = function(){
    this.initialize();
}

Tick.prototype.initialize = function(){
    this.tree = null;
    this.openNodes = [];
    this.nodeCount = 0;
    this.debug = null;
    this.target = null;
    this.blackboard = null;
}

Tick.prototype.enterNode = function(node){
    this.nodeCount++;
    this.openNodes.push(node);
  //document.write("enter node "+ node.id+" <br/>");
    
}

Tick.prototype.openNode = function(node){
    //call debug here
  //document.write("open node "+ node.id+" <br/>");
}

Tick.prototype.tickNode = function(node){
    //call debug here
 // document.write("tick node "+ node.id+" <br/>");
}

Tick.prototype.closeNode = function(node){
    //call debug here
    this.openNodes.pop();
  //document.write("close node "+ node.id+" <br/>");
}

Tick.prototype.exitNode = function(node){
    //call debug here
 //document.write("exit node "+ node.id+" <br/>");
}

var BehaviorTree = function(){
    this.initialize();
}

BehaviorTree.prototype.initialize = function(){
    this.id = createUUID();
    this.root = null;
}

BehaviorTree.prototype.tick = function(target, blackboard){
    //create a tick object
    var tick = new Tick();
    tick.target = target;
    tick.blackboard = blackboard;
    tick.tree = this;
    
    //tick node
    var status = this.root._execute(tick);
     
    //close nodes from last tick, if needed
    var lastOpenNodes = blackboard.get('openNodes', this.id);
    var curOpenNodes  = tick.openNodes.slice(0);
    
    //does not close if it is still open in this tick
    var start=0;
    for(var i=0; i<Math.min(lastOpenNodes.length, curOpenNodes.length);i++){
        start = i+1;
        if(lastOpenNodes[i] !== curOpenNodes[i]){
            break;
        }
    }
    
    //close the nodes
    for(var i=lastOpenNodes.length-1; i>=start;i--){
        lastOpenNodes[i]._close(tick);
    }
    
    //populate blackboard
    blackboard.set('openNodes', curOpenNodes, this.id);
    blackboard.set('nodeCount', tick.nodeCount, this.id);
}

var BaseNode = function(){
    this.initialize();
};

BaseNode.prototype.initialize = function(children){
    this.id = createUUID();
    
    this.children = [];
    
    if(children){
        for(var i=0;i<children.length;i++){
            this.children.push(children[i]);
        }
    }
};

BaseNode.prototype._execute = function(tick){
  
  //enter
    this._enter(tick);
     
    //open
    if(!tick.blackboard.get('isOpen', tick.tree.id, this.id)){
      
        this._open(tick);
    }
       
    //tick
    var status = this._tick(tick);
    
    //close
    if(status !== RUNNING){
        this._close(tick);
    }
    
    //exit
    this._exit(tick);
    
    return status;
}


//wrapper functions
BaseNode.prototype._enter = function(tick){
    tick.enterNode(this);
    this.enter(tick);
}

BaseNode.prototype._open = function(tick){
    tick.openNode(this);
    tick.blackboard.set('isOpen',true, tick.tree.id, this.id);
    this.open(tick);
}

BaseNode.prototype._tick = function(tick){
  
    tick.tickNode(this);
    return this.tick(tick);
}

BaseNode.prototype._close = function(tick){
    tick.closeNode(this);
    tick.blackboard.set('isOpen', false, tick.tree.id, this.id);
    this.close(tick);
}

BaseNode.prototype._exit = function(tick){
    tick.exitNode(this);
    this.exit(tick);
}

//override these to create nodes
BaseNode.prototype.enter = function(tick){};
BaseNode.prototype.open  = function(tick){};
BaseNode.prototype.tick  = function(tick){};
BaseNode.prototype.close  = function(tick){};
BaseNode.prototype.exit  = function(tick){};
//Composites

//Sequence
var Sequence = function() {
    this.initialize(arguments);
}

Sequence.prototype = new BaseNode();
Sequence.prototype.tick = function(tick) {
    for (var i=0; i<this.children.length; i++) {
        var status = this.children[i]._execute(tick);
 
        if (status !== SUCCESS) {
            return status;
        }
    }
 
    return SUCCESS;
}

var Priority = function() {
    this.initialize(arguments);
}
Priority.prototype = new BaseNode();
Priority.prototype.tick = function(tick) {
    for (var i=0; i<this.children.length; i++) {
        var status = this.children[i]._execute(tick);
 
        if (status !== FAILURE) {
            return status;
        }
    }
 
    return FAILURE;
}

var MemSequence = function() {
    this.initialize(arguments);
}
MemSequence.prototype = new BaseNode();
MemSequence.prototype.open = function(tick) {
    tick.blackboard.set('runningChild', 0, tick.tree.id, this.id);
}
 
MemSequence.prototype.tick = function(tick) {
    var child = tick.blackboard.get('runningChild', tick.tree.id, this.id);
    for (var i=child; i<this.children.length; i++) {
        var status = this.children[i]._execute(tick);
 
        if (status !== SUCCESS) {
            if (status === RUNNING) {
                tick.blackboard.set('runningChild', i, tick.tree.id, this.id);
            }
            return status;
        }
    }
 
    return SUCCESS;
}

var MemPriority = function() {
    this.initialize(arguments);
}
MemPriority.prototype = new BaseNode();
MemPriority.prototype.open = function(tick) {
    tick.blackboard.set('runningChild', 0, tick.tree.id, this.id);
}
 
MemPriority.prototype.tick = function(tick) {
    var child = tick.blackboard.get('runningChild', tick.tree.id, this.id);
    for (var i=child; i<this.children.length; i++) {
        var status = this.children[i]._execute(tick);
 
        if (status !== FAILURE) {
            if (status === RUNNING) {
                tick.blackboard.set('runningChild', i, tick.tree.id, this.id);
            }
            return status;
        }
    }
 
    return FAILURE;
};

//Decorator
var Inverter = function() {
    this.initialize(arguments);
};
Inverter.prototype = new BaseNode();
Inverter.prototype.tick = function(tick) {
    var child = this.children[0];
 
    if (!child) {
        return ERROR;
    }
 
    var status = child._execute(tick);
 
    if (status == SUCCESS)
        status = FAILURE;
    else if (status == FAILURE)
        status = SUCCESS;
 
    return status;
};

//ACTION
//Wait
var Wait = function(milliseconds) {
    this.endTime = milliseconds;
    this.initialize();
};
Wait.prototype = new BaseNode();
Wait.prototype.open = function(tick) {
    var startTime = (new Date()).getTime();
    tick.blackboard.set('startTime', startTime, tick.tree.id, this.id);
};
 
Wait.prototype.tick = function(tick) {
    var currTime = (new Date()).getTime();
    var startTime = tick.blackboard.get('startTime', tick.tree.id, this.id);
    
    if (currTime - startTime > this.endTime) {
        return SUCCESS;
    }
  
  if((currTime - startTime)%100 ===0){
    document.write("Wait "+ (currTime - startTime)/100 + "s<br/>");
  }
    return RUNNING;
};

//LOOP
var Loop = function(times){
  this.times = times;
  this.initialize();
}

Loop.prototype = new BaseNode();
Loop.prototype.tick = function(tick){
  if(this.times<=0){
    return SUCCESS;
  }
  
  this.times--;
  document.write("Loop one time，remain "+this.times+" times<br/>");               
  return RUNNING;
}

//Action
var Action1 = function(name){
  this.initialize();
  this.name = name;
};

Action1.prototype = new BaseNode();
Action1.prototype.tick = function(tick){
  document.write("Action "+this.name+" Done!<br/>");
  return SUCCESS;
};

//Condition
var IsAction = function(condition){
  this.initialize();
  this.condition = condition;
}

IsAction.prototype = new BaseNode();
IsAction.prototype.tick = function(tick){
  if(this.condition){
    document.write("Action Condition meet!<br>");
    return SUCCESS;
  }else
    {
      document.write("Action Condition can't meet<br\>");
      return FAILURE;
    }
}











































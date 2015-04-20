var token = '';
var weekStart = '';
var userId = 0;
var interval = 20000;

var projects = {};
var workspaces = {};
var tasks = {};

function get(url) {
	var xmlhttp;
	try {
		xmlhttp = new ActiveXObject('Msxml2.XMLHTTP');
	} catch (e) {
		try {
			xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');
		} catch (e) {
			xmlhttp = false;
		}
	}
	if (!xmlhttp && typeof(XMLHttpRequest) != 'undefined') {
		xmlhttp = new XMLHttpRequest();
	}

	xmlhttp.open('GET', url, false);
	xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	xmlhttp.setRequestHeader('Authorization', 'Bearer '+token);
	xmlhttp.send(null);

	if (xmlhttp.status == 200) {
		var data = JSON.parse(xmlhttp.responseText);
		if (data.data) {
			data = data.data;
		}
		/*postMessage({
			log: 'xmlhttp',
			data: data
		});*/
		return data;
	}
}

function getProjects() {
	return get('https://app.asana.com/api/1.0/projects?opt_fields=modified_at,color,notes,created_at,archived,assignee,workspace,name');
}

function getWorkspaces()  {
	return get('https://app.asana.com/api/1.0/workspaces');
}

function getProjectTasks(projectId) {
	return get('https://app.asana.com/api/1.0/projects/' + projectId + '/tasks?opt_fields=created_by,assignee,parent,modified_at,completed,name,assignee_status,created_at,completed,projects,notes,due_on&completed_since='+weekStart);
}

function getWorkspaceTasks(workspaceId) {
	return get('https://app.asana.com/api/1.0/workspaces/' + workspaceId + '/tasks?opt_fields=created_by,assignee,parent,modified_at,completed,name,assignee_status,created_at,completed,projects,notes,due_on&assignee=me&completed_since='+weekStart);
}

addEventListener('message', function(e) {
	var data = e.data;
	switch (data.cmd) {
		case 'updateTask':
			var taskId = data.taskId;
			var task = data.data;
			if (typeof(task.completed) != 'undefined') {
				tasks[taskId].completed = task.completed;
			}
			if (typeof(task.due_on) != 'undefined') {
				tasks[taskId].due_on = task.due_on;
			}
			if (typeof(task.assignee_status) != 'undefined') {
				tasks[taskId].assignee_status = task.assignee_status;
			}
			break;
		case 'init':
			token = data.token;
			weekStart = data.weekStart;
			userId = data.userId;
			interval = data.interval;
			update();
			break;
	}
}, false);

function update() {
	projects = {};
	workspaces = {};
	tasks = {};
	//postMessage({log: 'Start update'});

	var projectData = getProjects();
	//postMessage({log: 'ProjectData', data: projectData});
	for (var i in projectData){
		if (projectData[i].archived){
			continue;
		}

		var projectId = projectData[i].id;
		projects[projectId] = projectData[i];

		var taskData = getProjectTasks(projectId);
		projects[projectId].tasksCount = taskData.length;
		projects[projectId].detailed = true;

		if (!projects[projectId].tasksCount) continue;

		for (var i in taskData){

			// Skip task not assigned for me and not created by me
			if (userId != taskData[i].created_by.id && (!taskData[i].assignee || taskData[i].assignee.id != userId)){
				continue;
			}

			if (taskData[i].name && taskData[i].name[taskData[i].name.length - 1] === ':')
				continue;

			var taskId = taskData[i].id;
			tasks[taskId] = taskData[i];
			tasks[taskId].projectId = projectId;
			tasks[taskId].detailed = true;
		}	
	}

	var workspaceData = getWorkspaces();

	for (var i in workspaceData){
		var workspaceId = workspaceData[i].id;
		workspaces[workspaceId] = workspaceData[i];

		var taskData = getWorkspaceTasks(workspaceId);

		for (var i in taskData){
			if (taskData[i].projects.length){
				continue;
			}

			if (!projects[0]) {
				projects[0] = {
					detailed: true,
					name: 'No Project',
					tasksCount: 0
				};
			}

			var taskId = taskData[i].id;
			tasks[taskId] = taskData[i];
			tasks[taskId].projectId = 0;
			tasks[taskId].detailed = true;

			++projects[0].tasksCount;
		}
	}

	setTimeout(function(){
		update()
	}, interval);

	postMessage({
		tasks: tasks,
		projects: projects,
		workspaces: workspaces
	});

	//postMessage({log: 'Stop update'});
}
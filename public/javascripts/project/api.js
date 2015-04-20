tasksApp
	.config(function($httpProvider){
		delete $httpProvider.defaults.headers.common['X-Requested-With'];
	})
	.factory('api', function($http, $q, $rootScope){

		var extractToken = function(cookie){
			var match = cookie.match(/token=([^;]+)/);
			return !!match && decodeURIComponent(match[1]);
		};

		var process = function(method, url, data, params, defer){
			if (!defer)
				defer = $q.defer();
			
			var timeout = $rootScope.nextStart - new Date().getTime();
			if (timeout) {
				$rootScope.nextStart += 500; //Increment delay by 0.5 second
				window.setTimeout(function(){
					process(method, url, data, params).then(function(nextResult){
						defer.resolve(nextResult);
					}, function(error){
						defer.reject(error);
					});
				}, $rootScope.nextStart - new Date().getTime());
				return defer.promise;
			}

			var token = extractToken(document.cookie);

			$http({
				url: url,
				method: method,
				params: typeof(params) != 'undefined' ? params : {},
				data: typeof(data) != 'undefined' ? $.param(data) : '',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Authorization': 'Bearer ' + token
				}
			}).success(function(result, status, headers, config){
				defer.resolve(result);
			}).error(function(result, status, headers, config){
				if (status === 429){
					
					var nextStart = result.retry_after * 1000;
					if (!$rootScope.nextStart || nextStart < $rootScope.nextStart) {
						$rootScope.nextStart = nextStart;
					} else if ($rootScope.nextStart > 0) {
						$rootScope.nextStart += 500; //Increment delay by 0.5 second
					}

					window.setTimeout(function(){
						process(method, url, data, params, defer).then(function(nextResult){
							defer.resolve(nextResult);
						}, function(error){
							defer.reject(error);
						});
					}, $rootScope.nextStart);
					
					return;
				}
				if (result && result.errors && result.errors[0].message == 'Not Authorized'){
					window.location = '/';
					defer.reject(result);
					return;
				}
				defer.reject(result);
			});

			return defer.promise;
		};

		return {
			user: function(userId){
				if (!userId) userId = 'me';
				return process('GET', 'https://app.asana.com/api/1.0/users/' + userId);
			},
			projects: function(){
				return process('GET', 'https://app.asana.com/api/1.0/projects?opt_fields=modified_at,color,notes,created_at,archived,assignee,workspace,name');
			},
			project: function(projectId){
				return process('GET', 'https://app.asana.com/api/1.0/projects/' + projectId + '/tasks?opt_fields=assignee,parent,modified_at,completed,name,assignee_status,created_at,completed,projects,notes,due_on');
			},
			workspaces: function(){
				return process('GET', 'https://app.asana.com/api/1.0/workspaces');
			},
			projectTasks: function(projectId){
				return process('GET', 'https://app.asana.com/api/1.0/projects/' + projectId + '/tasks?opt_fields=created_by,assignee,parent,modified_at,completed,name,assignee_status,created_at,completed,projects,notes,due_on&completed_since='+moment().startOf('isoWeek').toISOString());
			},
			workspaceTasks: function(workspaceId){
				return process('GET', 'https://app.asana.com/api/1.0/workspaces/' + workspaceId + '/tasks?opt_fields=created_by,assignee,parent,modified_at,completed,name,assignee_status,created_at,completed,projects,notes,due_on&assignee=me&completed_since='+moment().startOf('isoWeek').toISOString());
			},
			task: function(taskId){
				return process('GET', 'https://app.asana.com/api/1.0/tasks/' + taskId);
			},
			//tasks: function(filter){
			//	return process('GET', 'https://app.asana.com/api/1.0/tasks/', filter);
			//},
			updateTask: function(taskId, data){
				if ($rootScope.updater) {
					$rootScope.updater.postMessage({
						cmd: 'updateTask',
						taskId: taskId,
						data: data
					});
				}
				return process('PUT', 'https://app.asana.com/api/1.0/tasks/' + taskId, data);
			},
			logPage: function(user, data){
				return process('POST', '/logPage', {user: user, data: data});
			},
			logCheckBox: function(user){
				return process('POST', '/logCheckBox', {user: user});
			},
			logMove: function(user){
				return process('POST', '/logMove', {user: user});
			},
			createTask: function(data){
				return process('POST', 'https://app.asana.com/api/1.0/tasks/14325858291408/subtasks', data);
			},
			getTasksOrder: function(user) {
				return process('POST', '/getTasksOrder', {user: user});
			},
			setTasksOrder: function(user, orders) {
				return process('POST', '/setTasksOrder', {user:user, orders: orders});
			}
		}
	})
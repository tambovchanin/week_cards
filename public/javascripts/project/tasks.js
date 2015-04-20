var getDayDateString = function(day){
	return moment().isoWeekday(day).format('YYYY-MM-DD');
}

var getDayMonthString = function(date){
	return moment(date).format('MMM DD');
}

var isDateFromThisWeek = function(date){
	return moment().isoWeekday() >= moment().diff(date, 'days');
}

var convertAsanaColor = function(colorIn){
	if (!colorIn) return '#000';

	var color = colorIn.replace(/-/g, '');

	var colortable = {
		darkpink: '#B13F94',
		darkteal: '#008EAA',
		darkbrown: '#906461',
		darkwarmgray: '#493C3D',
		darkpurple: '#6743B3',
		lightorange: '#FACDAA',
		lightred: '#EFBDBD',
		lightteal: '#AAD1EB',
		lightpurple: '#DACAE0',
		lightyellow: '#FFEDA4',
		lightwarmgray: '#CEC5C6'
	};

	if (colortable[color]) return colortable[color]
	return color;
}

moment.lang('en');

var tasksApp = angular.module('tasksApp', []);

tasksApp.controller('tasksCntr', function($scope, api, $log, $rootScope){
	$scope.projects = {};
	$scope.tasks = {};
	$scope.workspaces = {};
	$scope.tasksOrder = {0: false, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}};
	$scope.tasksOrderNext = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0};

	$scope.init = function(user){
		$scope.user = user;
	}

	window.projects = $scope.projects;
	window.tasks = $scope.tasks;
	window.workspaces = $scope.workspaces;
	window.api = api;
	window.tasksOrder = $scope.tasksOrder;
	window.tasksOrderNext = $scope.tasksOrderNext;

	$rootScope.updater = false;

	var nanobar = new Nanobar({
		bg: '#acf',
		target: document.getElementById('progress'),
		id: 'progress'
	});

	$scope.loading = true;
	$scope.progress = 0;

	var saveTasksOrder = function(){
		api.setTasksOrder($rootScope.user, $scope.tasksOrder);
		$scope.debug_info = $rootScope;
	};

	var clearTasksOrder = function(){
		var newOrder = {0: false, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}};
		var needSave = false;
		for (var column in $scope.tasksOrder){
			if (!column) continue;
			for (var taskId in $scope.tasksOrder[column]){
				if ($scope.tasks[taskId]){
					newOrder[column][taskId] = $scope.tasksOrder[column][taskId];
				} else {
					needSave = true;
				}
			}
		}
		if (needSave){
			$scope.tasksOrder = newOrder;
			saveTasksOrder();
		}
	};

	var initTasksOrder = function(orderData){
		if (!orderData) return;
		for (var column in $scope.tasksOrder){
			if (!orderData[column]) continue;

			for (var taskId in orderData[column]){
				$scope.tasksOrder[column][taskId] = orderData[column][taskId];
				if ($scope.tasksOrderNext[column] <= $scope.tasksOrder[column][taskId]){
					$scope.tasksOrderNext[column] = $scope.tasksOrder[column][taskId] + 1;
				}
			}
		}
	};

	var appendTasksOrder = function(column, taskId){
		$scope.tasksOrder[column][taskId] = $scope.tasksOrderNext[column];
		++$scope.tasksOrderNext[column];
	};

	$scope.$on('reposition', function(event, taskId, fromColumn, toColumn, toIndex){
		var fromIndex = $scope.tasksOrder[fromColumn][taskId];
		delete $scope.tasksOrder[fromColumn][taskId];
		for (var i in $scope.tasksOrder[fromColumn]){
			if ($scope.tasksOrder[fromColumn][i] > fromIndex){
				--$scope.tasksOrder[fromColumn][i];
			}
		}
		if (toColumn == fromColumn && toIndex > fromIndex){
			--toIndex;
		}
		for (var i in $scope.tasksOrder[toColumn]){
			if ($scope.tasksOrder[toColumn][i] >= toIndex){
				++$scope.tasksOrder[toColumn][i];
			}
		}
		$scope.tasksOrder[toColumn][taskId] = toIndex;
		if ($scope.tasksOrderNext[toColumn] <= toIndex){
			$scope.tasksOrderNext[toColumn] = toIndex + 1;
		}
		saveTasksOrder();
	});

	var updateProgress = function(init){

		var result = 0;

		for (var i in $scope.projects)
			if ($scope.projects[i].detailed)
				++result

		$scope.progress = Math.round(100 * result / Object.keys($scope.projects).length);
		nanobar.go($scope.progress);

		if ($scope.progress == 100){

			clearTasksOrder();

			if (!init){
				return;
			}

			window.api = api;

			var logData = {
				projectsCnt: Object.keys($scope.projects).length,
				tasksCnt: Object.keys($scope.tasks).length
			};
			if (window.document.cookie == 'logined'){
				logData.loadType = 'refresh';
			} else {
				window.document.cookie = 'logined';
				logData.loadType = 'login';
			}
			logData.window = {
				width: window.innerWidth,
				height: window.innerHeight
			};
			logData.screen = {
				width: screen.width,
				height: screen.height
			};
			api.logPage($rootScope.user, logData);

			window.setTimeout(function(){ //small time to show 100% progress and render interface
				$scope.loading = false;
				$scope.$apply();
			}, 1000);

			if (typeof(Worker) !== "undefined") {
				$rootScope.updater = new Worker('/javascripts/project/updater.js');
				$rootScope.updater.onmessage = function(event) {
					var data = event.data;
					/*if (data.log) {
						console.log(data);
						return;
					}*/
					$scope.tasks = data.tasks;
					$scope.projects = data.projects;
					$scope.workspaces = data.workspaces;
					$scope.$apply();
				};

				var match = document.cookie.match(/token=([^;]+)/);
				var token = !!match && decodeURIComponent(match[1]);

				$rootScope.updater.postMessage({
					cmd: 'init',
					token: token,
					weekStart: moment().startOf('isoWeek').toISOString(),
					userId: $rootScope.user.id,
					interval: 15000
				});
			} else {
				window.setTimeout(function() {
					updateTsks()
				}, 15000);
			}
		}
	};

	//Function for getting tasks list for display
	var getTasks = function(filter, column){
		var result = [];
		for (var i in $scope.tasks){
			var task = $scope.tasks[i];
			if (
				((task.assignee && (task.assignee.id === $rootScope.user.id)) // Assigned to me
				|| (!task.assignee && (task.created_by.id === $rootScope.user.id))) // Unassigned created by me
				&& (task.completed && isDateFromThisWeek(task.modified_at) || !task.completed) // This week completed tasks and all uncomleted
				){
				if (filter(task)){
					if (typeof($scope.tasksOrder[column][task.id]) == 'undefined'){
						$scope.tasksOrder[column][task.id] = $scope.tasksOrderNext[column];
						++$scope.tasksOrderNext[column];
					}
					result.push(task);
				}
			}
		}

		var movedToColumn = 1;
		if ($rootScope.movedTask){
			movedToColumn = $rootScope.movedToDay + 1;
			if (!movedToColumn) ++movedToColumn;
		}
		result.sort(function(a, b){
			if ($rootScope.movedTask && movedToColumn == column && ($rootScope.movedTask.id == a.id || $rootScope.movedTask.id == b.id)){

				if ($rootScope.movedTask.id == a.id){
					if ($rootScope.movedToIndex <= $scope.tasksOrder[column][b.id])
						return -1;
					if ($rootScope.movedToIndex > $scope.tasksOrder[column][b.id])
						return 1;
				}

				if ($rootScope.movedTask.id == b.id){
					if ($rootScope.movedToIndex <= $scope.tasksOrder[column][a.id])
						return 1;
					if ($rootScope.movedToIndex > $scope.tasksOrder[column][a.id])
						return -1;
				}
			} else {
				if ($scope.tasksOrder[column][a.id] < $scope.tasksOrder[column][b.id])
					return -1;
				if ($scope.tasksOrder[column][a.id] > $scope.tasksOrder[column][b.id])
					return 1;
			}
			return 0;
		});
		return result;
	};

	$scope.getCurrentDay = function(){
		return moment().isoWeekday();
	}

	$scope.getInbox = function(){

		return getTasks(function(task){
			var stringDate = getDayDateString(1);
			return (!task.due_on && task.assignee_status == 'inbox') ||
				task.due_on < stringDate ||
				($rootScope.movedTask && $rootScope.movedTask.id == task.id && $rootScope.movedToDay == 0);
		}, 1);
	};

	$scope.getDayTasks = function(day){
		var stringDate = getDayDateString(day);
		return getTasks(function(task){
			return task.due_on == stringDate || !task.due_on && day == $scope.getCurrentDay() && task.assignee_status == 'today' || ($rootScope.movedTask && $rootScope.movedTask.id == task.id && $rootScope.movedToDay == day);
		}, day+1);
	};

	$scope.getFutureTasks = function(){
		var stringDate = getDayDateString(5);
		return getTasks(function(task){
			return task.due_on > stringDate ||
				!task.due_on && $scope.getCurrentDay() > 5 && task.assignee_status == 'today' ||
				!task.due_on && (task.assignee_status == 'later' || task.assignee_status == 'upcoming') ||
				($rootScope.movedTask && $rootScope.movedTask.id == task.id && $rootScope.movedToDay == 6);
		}, 7);
	};

	var updateTsks = function(init){
		api.user().then(function(userData){
			$rootScope.user = userData.data;

			api.getTasksOrder($rootScope.user).then(function(orderData){
				initTasksOrder(orderData);

				api.projects().then(function(projectData){
					for (var i in projectData.data){
						if (projectData.data[i].archived){
							updateProgress(init);
							continue;
						}

						(function(){ //Closure to save projectId data
							var projectId = projectData.data[i].id;
							$scope.projects[projectId] = projectData.data[i];
							$scope.projects[projectId].detailed = false;
							$scope.projects[projectId].tasksCount = -1;

							api.projectTasks(projectId).then(function(taskData){
								$scope.projects[projectId].tasksCount = taskData.data.length;
								$scope.projects[projectId].detailed = true;

								if (!$scope.projects[projectId].tasksCount) return;

								for (var i in taskData.data){

									// Skip task not assigned for me and not created by me
									if ($rootScope.user.id != taskData.data[i].created_by.id && (!taskData.data[i].assignee || taskData.data[i].assignee.id != $rootScope.user.id)){
										continue;
									}

									if (taskData.data[i].name && taskData.data[i].name[taskData.data[i].name.length - 1] === ':')
										continue;

									var taskId = taskData.data[i].id;
									$scope.tasks[taskId] = taskData.data[i];
									$scope.tasks[taskId].projectId = projectId;
									$scope.tasks[taskId].detailed = true;
								}
								updateProgress(init);
							}, function(error){
								$log.error(error);
							});
						})();
					}
				}, function(error){
					$log.error(error);
				});

				api.workspaces().then(function(workspaceData){
					for (var i in workspaceData.data){
						(function(){ //Closure to save workspaceId data
							var idx = i;
							var workspaceId = workspaceData.data[i].id;
							$scope.workspaces[workspaceId] = workspaceData.data[i];
							$scope.workspaces[workspaceId].detailed = false;
							$scope.workspaces[workspaceId].tasksCount = -1;

							api.workspaceTasks(workspaceId).then(function(taskData){

								$scope.workspaces[workspaceId].taskCount = taskData.data.length;
								$scope.workspaces[workspaceId].detailed = true;

								for (var i in taskData.data){
									if (taskData.data[i].projects.length){
										continue;
									}

									if (!$scope.projects[0])
										$scope.projects[0] = {
											detailed: false,
											name: 'No Project',
											tasksCount: -1
										};

									var taskId = taskData.data[i].id;
									$scope.tasks[taskId] = taskData.data[i];
									$scope.tasks[taskId].projectId = 0;
									$scope.tasks[taskId].detailed = true;

									++$scope.projects[0].tasksCount;
								}

								if ($scope.projects[0])
									$scope.projects[0].detailed = true;
								if (init && workspaceData.data.length === idx)
									updateProgress(init);
							}, function(error){
								$log.error(error);
							});
						})();
					}
				}, function(error){
					$log.error(error);
				});
			}, function(error){
				$log.error(error);
			});
		}, function(error){
			$log.error(error);
		})
	};

	updateTsks(true);

	$(window).on('scroll', function(){
		if (window.scrollY >= 60){
			$('#tasks-interface').addClass('scrolled');
		} else {
			$('#tasks-interface').removeClass('scrolled');
		}
	});

	$('#logout a').click(function(){
		window.document.cookie = '';
	});

	$scope.isMovedCopy = function(task){
		return $rootScope.movedTask && $rootScope.movedTask.id == task.id;
	}
})
	.directive('task', function(api, $log, $rootScope){
		return {
			restrict: 'C',
			scope: {
				model: '=',
				project: '='
			},
			link: function(scope, element, attrs){
				var stringDate = getDayDateString(1);

				scope.overdue = function(){
					return !scope.model.completed && scope.model.due_on && scope.model.due_on < stringDate;
				}

				scope.nextweek = function(){
					return scope.model.due_on > getDayDateString(5);
				}

				scope.shortDate = function(){
					return scope.model.due_on ? getDayMonthString(new Date(scope.model.due_on)) : '';
				}

				var lastX; //Last X mouse position
				var lastY; //Last Y mouse position
				var down = false; //mouse down fgal
				var drag = false; //is drag now
				var copy = false; //Draggable element copy
				var elementX = false; //Drag X
				var elementY = false; //Drag Y

				var timer = false; //Timer for notes showing

				var testDayColumns = function(x){
					var column = -1;
					$('.day-column').each(function(){
						var width = $(this).outerWidth();
						var offset = $(this).offset();
						if (offset.left < x && x < offset.left + width){
							column = parseInt($(this).attr('day'));
							return false;
						}
					});

					$rootScope.movedToDay = column;
				}

				var testIndex = function(y){
					var column = $rootScope.movedToDay + 1;
					if (!column) ++column; // -1 for inbox == 1st column

					var weekColumn = $('.week-column[column=' + column + ']');
					var tasks = weekColumn.find('.task');

					if (tasks.length < 1){
						return;
					}

					var find = false;
					var currentTop = weekColumn.offset().top;
					tasks.each(function(){
						if ($(this).find('> .movedcopy').length > 0) return;

						var taskHeight = $(this).outerHeight(true);
						var taskY = currentTop + taskHeight / 2;

						if (y < taskY){
							$rootScope.movedToIndex = parseInt($(this).attr('order'));
							find = true;
							return false;
						}

						currentTop += taskHeight;
					});

					if (!find){
						$rootScope.movedToIndex = parseInt(weekColumn.attr('nextorder'));
					}
				}
				
				var checkMove = function(event){
					if (drag){
						event.preventDefault();

						copy.css({
							left: elementX + event.pageX - lastX,
							top: elementY + event.pageY - lastY
						});

						var lastDay = $rootScope.movedToDay;
						var lastIndex = $rootScope.movedToIndex;
						testDayColumns(elementX + event.pageX - lastX + copy.outerWidth() / 2);
						testIndex(elementY + event.pageY - lastY + copy.outerHeight() / 2);
						if (lastDay != $rootScope.movedToDay || lastIndex != $rootScope.movedToIndex){ //reduce loop count for smooth move
							scope.$apply();
						}
					}
				};

				var endMoving = function(){
					$rootScope.movedToDay = false;
					$rootScope.movedTask = false;
					$rootScope.movedFromDay = false;
				}

				var checkUp = function(event){
					down = false;
					if (drag){
						event.preventDefault();

						$('body').off('mousemove');
						$('body').off('mouseup');
						copy.remove();
						copy = false;
						drag = false;
						//scope.onend();
						var fromColumn = $rootScope.movedFromDay + 1;
						if (!fromColumn) ++fromColumn;
						var toColumn = $rootScope.movedToDay + 1;
						if (!toColumn) ++toColumn;
						scope.$emit('reposition', $rootScope.movedTask.id, fromColumn, toColumn, $rootScope.movedToIndex);

						if ($rootScope.movedToDay != $rootScope.movedFromDay){
							var updateData = {};
							if ($rootScope.movedToDay < 0){
								updateData.due_on = null;
								updateData.assignee_status = 'inbox';
							} else if ($rootScope.movedToDay == 6){
								updateData.due_on = null;
								updateData.assignee_status = 'upcoming';
							} else {
								var due_on = getDayDateString($rootScope.movedToDay);
								updateData.due_on = due_on;
								updateData.assignee_status = 'inbox';
							}

							$.extend(scope.model, updateData);

							if (updateData.due_on == null)
								updateData.due_on = 'null';

							api.logMove($rootScope.user);
							api.updateTask(scope.model.id, updateData).then(function(data){
								$.extend(scope.model, data.data);
							}, function(error){
								$log.error(error);
							});

							endMoving();
						} else {
							endMoving();
							scope.$apply();
						}
					}
				};

				var dayColumn = element.parents('.day-column:first');
				var currentDay = dayColumn.length > 0 ? parseInt(dayColumn.attr('day')) : -1;

				element.on('click', '.fa', function(event){
					event.stopPropagation();

					scope.model.completed = !scope.model.completed;

					api.logCheckBox($rootScope.user);
					api.updateTask(scope.model.id, {completed: scope.model.completed}).then(function(data){
						//$.extend(scope.model, data.data);
					}, function(error){
						$log.error(error);
					});

					scope.$apply();
				}).on('mousemove', function(event){
					event.preventDefault();

					window.clearTimeout(timer);

					if (down && !drag && Math.max(Math.abs(lastX - event.pageX), Math.abs(lastY - event.pageY)) > 2){
						element.removeClass('hovered');
						drag = true;
						copy = $(element.get(0).outerHTML).appendTo('body').addClass('moved');
						var offset = element.offset();
						copy.css({
							width: element.outerWidth()
						});
						elementX = offset.left;
						elementY = offset.top;

						$('body').on('mousemove', checkMove);
						$('body').on('mouseup', checkUp);

						$rootScope.movedTask = scope.model;
						$rootScope.movedFromDay = currentDay;
						scope.$apply();
					}

					if (drag){
						checkMove(event);
					} else if (!down){
						timer = window.setTimeout(function(){
							element.addClass('hovered');
						}, 3000);

						lastX = event.pageX;
						lastY = event.pageY;
					}
				}).on('mouseleave', function(){
					window.clearTimeout(timer);
					element.removeClass('hovered');
				}).on('mousedown', function(event){
					event.preventDefault();
					down = true;
				}).on('mouseup', checkUp);

				scope.isMovedCopy = function(){
					return $rootScope.movedTask && $rootScope.movedTask.id == scope.model.id;
				}


				scope.debug = {
					diff: function(date){
						return moment().diff(date, 'days');
					},
					user: function(id){
						return id == $rootScope.user.id ? 'me' : id;
					},
					day: function(){
						return moment().isoWeekday();
					},
					today: function(){
						return moment().format("DD MMM YY")
					},
					week: function(date){
						return moment().isoWeekday() >= moment().diff(date, 'days');
					}
				}

				scope.getColor = function(){
					if (scope.model.completed) return '#b1b1b1';
					return convertAsanaColor(scope.project.color);
				}
			},
			template: '<a href="https://app.asana.com/0/{{project.id || model.id}}/{{model.id}}" target="_blank"></a>' +
				'<div class="task-container" ng-class="{completed: model.completed, overdue: overdue(), movedcopy: isMovedCopy()}">' +
				'<div class="task-caption">{{model.name}}</div>' +
				'<div class="task-project-caption" style="color: {{getColor()}}">' +
				'{{project.name|limitTo:24}}{{project.name.length > 25 ? "..." : ""}}' +
				'<i class="hover-hide fa fa-check" ng-if="model.completed"></i>' +
				'<i class="hover-show fa fa-check-square-o" ng-if="model.completed"></i>' +
				'<i class="hover-show fa fa-square-o" ng-if="!model.completed"></i>' +
				'</div>' +
				'<div class="task-undermessage overdue" ng-if="overdue()">Overdue - {{shortDate()}}</div>' +
				'<div class="task-undermessage next-week" ng-if="nextweek()">Next week - {{shortDate()}}</div>' +
//				'<pre>' +
//				'<p>Id: {{model.id}}</p>' +
//				'<p>Created: {{debug.user(model.created_by.id)}}</p>' +
//				'<p>Asign: {{model.assignee?debug.user(model.assignee.id):null}}</p>' +
//				'<p>Due: {{model.due_on}}</p>' +
//				'<p>Mdf: {{model.modified_at|date:"mediumDate"}}</p>' +
//				'<p>Diff: {{debug.diff(model.modified_at)}}</p>' +
//				'<p>Day: {{debug.day()}}</p>' +
//				'<p>TD: {{debug.today()}}</p>' +
//				'<p>Wk: {{debug.week(model.modified_at)}}</p>' +
//				'<p>Status: {{model.assignee_status}}</p>' +
//				'</pre>' +
				'<div ng-if="model.notes" class="task-description">{{model.notes|limitTo:100}}{{model.notes.length > 100 ? "..." : ""}}</div>' +
				'</div>'
		}
	})
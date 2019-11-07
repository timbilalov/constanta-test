(function() {
	const POLLING_DELAY = 60000;
	const STORAGE_PREFIX = 'constanta-test-';
	const POPUP_OPENED_CLASS = '_popup-opened';
	const html = document.documentElement;
	const SORT_VALUE_ASC = 'asc';
	const SORT_VALUE_DESC = 'desc';

	new Vue({
		el: '#app',

		data: {
			searchText: '',
			fetching: false,
			collection: [],
			fetchingData: [],
			sort: null,
			activeItems: [],
			itemsInCart: [],
			currentView: 'list',
			showPopup: false,
		},

		computed: {
			collectionFiltered() {
				if (!this.searchText || this.searchText.trim() === '') {
					return this.collection;
				}

				// TODO: Можно сделать более правильный механизм поиска
				// по введённой фразе, чем такая простая регулярка.
				const reg = new RegExp(`${this.searchText.trim().toLowerCase()}`, 'gim');

				const collectionSliced = this.collection.slice(0).filter(el => {
					let res = false;
					for (let prop in el) {
						const value = el[prop];
						const valueText = '' + value;
						if (reg.test(valueText)) {
							res = true;
						}
					}
					return res;
				});
				return collectionSliced;
			},
			collectionSorted() {
				if (!this.sort) {
					return this.collectionFiltered;
				}

				const { prop, dir } = this.sort;
				const collectionSliced = this.collectionFiltered.slice(0);
				const sortRes1 = dir === SORT_VALUE_ASC ? 1 : -1;
				const sortRes2 = sortRes1 * -1;

				collectionSliced.sort((a, b) => {
					if (a[prop] > b[prop]) {
						return sortRes1;
					} else if (a[prop] < b[prop]) {
						return sortRes2;
					} else {
						return 0;
					}
				});
				return collectionSliced;
			},
			totalCost() {
				if (!this.itemsInCart.length) {
					return 0;
				}

				let total = 0;
				this.itemsInCart.forEach(el => {
					const value = el.cost_in_credits;
					total += parseFloat(value) || 0;
				});
				return total;
			},
		},

		methods: {
			// TODO: Можно добавить обработку случая, когда данные с сервера не приходят
			// (именно на странице что-либо выводить).
			fetchData(url = 'https://swapi.co/api/starships/') {
				this.fetching = true;
				this.stopPolling();
				const xhr = new XMLHttpRequest();
				xhr.open('GET', url, true);
				xhr.send();
				xhr.onreadystatechange = () => {
					if (xhr.readyState != 4) {
						return;
					}

				  	if (xhr.status != 200) {
				    	console.error(xhr.status + ': ' + xhr.statusText);
				    	return;
				  	} else {
				    	this.parseData(xhr.responseText);
				  	}
				}
			},
			parseData(data) {
				let parsed = null;
				try {
					parsed = JSON.parse(data);
				} catch(e) {
					console.error('Wrong type of data', e);
					return;
				}

				const { results, next } = parsed;

				// NOTE: С сервера приходят данные в виде строк. А в приложении есть работа с числами.
				// Поэтому находим строки-числа, и переводим их в настоящие числа. Сделав это один раз
				// при парсинге, избавляем себя от необходимости делать такое преобразование в дальнейшем.
				const resultsEnchanced = results.slice(0).map(el => {
					for (let prop in el) {
						const value = el[prop];
						if ('' + parseFloat(value) === value) {
							el[prop] = parseFloat(value);
						}
					}
				});

				this.fetchingData = this.fetchingData.concat(results);

				if (next) {
					this.fetchData(next);
				} else {
					this.fetchingData.forEach(item => {
						const currentCollectionItem = this.collection.filter(el => el.name === item.name)[0];
						if (!currentCollectionItem) {
							this.collection.push(item);
							return;
						}

						for (let prop in item) {
							if (currentCollectionItem[prop] !== item[prop]) {
								currentCollectionItem[prop] = item[prop];
							}
						}
					});

					this.fetching = false;
					this.fetchingData = [];
					this.startPolling();
				}
			},
			startPolling() {
				this._pollingTimeout = setTimeout(() => this.fetchData(), POLLING_DELAY);
			},
			stopPolling() {
				this._pollingTimeout && clearTimeout(this._pollingTimeout);
			},
			toggleSort(prop) {
				let newSort;
				if (!this.sort || this.sort.prop !== prop) {
					newSort = {
						prop,
						dir: SORT_VALUE_ASC,
					};
				} else {
					const newDir = this.sort.dir === SORT_VALUE_ASC ? SORT_VALUE_DESC : SORT_VALUE_ASC;
					newSort = {
						prop,
						dir: newDir,
					};
				}
				return this.sort = newSort;
			},
			clearSort() {
				this.sort = null;
			},
			// TODO: Можно добавить проверку на возможность использования localStorage.
			storageSet(key, value) {
				window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
			},
			storageGet(key) {
				const value = window.localStorage.getItem(STORAGE_PREFIX + key);
				if (!value) {
					return;
				}
				return JSON.parse(value);
			},
			toggleActiveItem(item) {
				const index = this.activeItems.indexOf(item);
				if (index >= 0) {
					this.activeItems.splice(index, 1);
				} else {
					this.activeItems.push(item);
				}
			},
			toggleInCart(item) {
				const index = this.itemsInCart.indexOf(item);
				if (index >= 0) {
					this.itemsInCart.splice(index, 1);
				} else {
					this.itemsInCart.push(item);
				}
			},
			loadSavedData(key) {
				const savedData = this.storageGet(key);
				if (savedData !== undefined) {
					this[key] = savedData;
				}
			},
			submitForm() {
				// TODO: Возможно, есть более универсальный и правильный способ
				// сделать сброс всех основных параметров. При этом, я бы не стал дестроить
				// и заново создавать компонент/приложение, так как это bad practice
				// и чревато серьёзными дырами в производительности.
				this.itemsInCart = [];
				this.activeItems = [];
				this.showPopup = false;
				this.currentView = 'list';
				this.searchText = '';
			},
			checkPopupOpened() {
				if (this.showPopup) {
					html.classList.add(POPUP_OPENED_CLASS);
				} else {
					html.classList.remove(POPUP_OPENED_CLASS);
				}
			},
		},

		watch: {
			// TODO: Когда вотчер видит изменение после подтягивания данных из localStorage,
			// он делает повторную запись в него, с тем же значением.
			// При рефакторинге можно данный момент подправить.
			sort() {
				this.storageSet('sort', this.sort);
			},
			collection() {
				this.storageSet('collection', this.collection);
			},
			showPopup() {
				this.checkPopupOpened();
			},
		},

		mounted() {
			this.loadSavedData('sort');
			// NOTE: В задании явно не было указано, чтобы сохранялись элементы коллекции,
			// но, во-первых, сервис swapi.co иногда работает с перебоями, либо медленно отдаёт данные,
			// во-вторых, при перезагрузке страницы каждый раз делать fetch — некрасиво мелькает страница.
			this.loadSavedData('collection');

			this.fetchData();
			this.checkPopupOpened();
		},
	})
})();
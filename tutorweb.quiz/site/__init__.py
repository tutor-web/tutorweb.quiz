def includeme(config):
    config.add_static_view('static', 'tutorweb.quiz.site:static')
    config.add_jinja2_search_path("tutorweb.quiz.site:templates")
    config.add_route('home', '/')
    config.scan('.')

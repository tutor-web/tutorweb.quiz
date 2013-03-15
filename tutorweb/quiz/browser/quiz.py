from Products.CMFCore.utils import getToolByName
from Products.Five import BrowserView
from Products.Five.browser.pagetemplatefile import ViewPageTemplateFile


class QuizView(BrowserView):
    """
    Render quiz holding page
    """
    index = ViewPageTemplateFile("do-quiz.pt")

    def __call__(self):
        return self.render()

    def render(self):
        return self.index()

    def resourceUrl(self, urlFragment):
        """Add portal URL to fragment"""
        url = getToolByName(self.context, 'portal_url')()
        url += '/' + urlFragment

        # Append a modified stamp for resources
        if url.rsplit('/',1)[-1] in ['quiz.js', 'quiz.css']:
            f = self.context.restrictedTraverse(urlFragment).context
            if hasattr(f, 'lmt'):
                url += '?timestamp=' + str(f.lmt)
        if url.rsplit('/',1)[-1] in ['logo.jpg']:
            url += '?timestamp=' + str(self.context.restrictedTraverse(urlFragment).modified().timeTime())
        return url


class QuizManifestView(QuizView):
    """
    Render a manifest of all resources the quiz requires
    """
    def resourceUrl(self, urlFragment):
        """Make a note of all URLs requested"""
        url = super(QuizManifestView, self).resourceUrl(urlFragment)
        if not url.endswith('do-quiz.appcache'):
            self.requiredResources.append(url)
        return url

    def render(self):
        # Render template, which will add to resources it needs
        self.requiredResources = []
        template = super(QuizManifestView, self).render()

        # Turn resource list into manifest
        manifest = "CACHE MANIFEST\n\n"
        for r in self.requiredResources:
            manifest += r + "\n"

        # Allow access to API calls
        manifest += "\nNETWORK:\n"
        for r in [self.resourceUrl('')]:
            manifest += r + "\n"

        # Version that can be bumped if necessary
        manifest += "\n# v1\n"

        self.request.response.setHeader("Content-type", "text/cache-manifest")
        return manifest

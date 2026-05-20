<script lang="ts">
</script>

<div class="dashboard">
	<header class="dashboard-header">
		<h1 class="dashboard-title">Projects</h1>
	</header>

	<div class="dashboard-body">
		<p class="empty-hint">No projects yet.</p>
	</div>
</div>

<style>
.dashboard {
	display: flex;
	flex-direction: column;
	height: 100%;
	padding: var(--sp-6);
	max-width: 860px;
	margin: 0 auto;
	width: 100%;
}

.dashboard-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: var(--sp-5);
	border-bottom: 1px solid var(--border-subtle);
	margin-bottom: var(--sp-6);
}

.dashboard-title {
	font-size: 22px;
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.01em;
}

.dashboard-body {
	flex: 1;
	min-height: 0;
}

.empty-hint {
	color: var(--text-muted);
	font-size: 14px;
}
</style>

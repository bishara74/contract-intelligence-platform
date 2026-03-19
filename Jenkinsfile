pipeline {
    agent any

    environment {
        APP_NAME = 'contract-intel'
        PYTHON_IMAGE = 'python:3.12-slim'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh "echo 'Branch: ${env.BRANCH_NAME}, Build: #${env.BUILD_NUMBER}'"
            }
        }

        stage('Lint') {
            steps {
                dir('backend') {
                    sh """
                        docker run --rm \
                            -v \$(pwd):/app \
                            -w /app \
                            ${PYTHON_IMAGE} \
                            bash -c "pip install ruff && ruff check app/"
                    """
                }
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    sh "docker build -t ${APP_NAME}-test -f Dockerfile ."
                    sh """
                        docker run --rm \
                            -e DATABASE_URL=sqlite+aiosqlite:///test.db \
                            -e OPENAI_API_KEY=fake-key-for-testing \
                            -e PINECONE_API_KEY=fake-key-for-testing \
                            -e PINECONE_INDEX_NAME=test-index \
                            -e R2_ENDPOINT_URL=http://fake-r2 \
                            -e R2_ACCESS_KEY_ID=fake \
                            -e R2_SECRET_ACCESS_KEY=fake \
                            -e R2_BUCKET_NAME=contract-intelligence \
                            -e USE_DYNAMODB=false \
                            -e USE_LAMBDA=false \
                            ${APP_NAME}-test \
                            python -m pytest tests/ -v --tb=short
                    """
                }
            }
        }
    }

    post {
        success {
            echo "${APP_NAME} pipeline completed successfully."
        }
        failure {
            echo "${APP_NAME} pipeline failed. Check the logs above."
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}

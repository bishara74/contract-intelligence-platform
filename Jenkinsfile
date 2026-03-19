// Contract Intel CI/CD Pipeline — Automated via GitHub Webhook
pipeline {
    agent any

    environment {
        APP_NAME = 'contract-intel'
        PYTHON_IMAGE = 'python:3.12-slim'
        AWS_REGION = 'eu-north-1'
        ECR_REPO = '916868259011.dkr.ecr.eu-north-1.amazonaws.com/contract-intel-process'
    }

    stages {
        // Stage 1: Clone the repository and print build info
        stage('Checkout') {
            steps {
                checkout scm
                sh "echo 'Branch: ${env.BRANCH_NAME}, Build: #${env.BUILD_NUMBER}'"
            }
        }

        // Stage 2: Run Ruff linter on backend code inside a disposable container
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

        // Stage 3: Build the backend image and run the full pytest suite with mocked services
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

        // Stage 4: Build Docker images for the backend API and Lambda function in parallel
        stage('Build Images') {
            parallel {
                stage('Build Backend Image') {
                    steps {
                        dir('backend') {
                            sh """
                                docker build -t ${APP_NAME}-backend:\${BUILD_NUMBER} .
                                docker tag ${APP_NAME}-backend:\${BUILD_NUMBER} ${APP_NAME}-backend:latest
                            """
                        }
                    }
                }
                stage('Build Lambda Image') {
                    steps {
                        dir('lambda/process-contract') {
                            sh """
                                docker build -t ${APP_NAME}-lambda:\${BUILD_NUMBER} .
                                docker tag ${APP_NAME}-lambda:\${BUILD_NUMBER} ${APP_NAME}-lambda:latest
                            """
                        }
                    }
                }
            }
        }

        // Stage 5: Push the Lambda container image to ECR and update the Lambda function (main branch only)
        stage('Push to ECR') {
            when { expression { return true } }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-credentials']]) {
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

                        docker tag ${APP_NAME}-lambda:\${BUILD_NUMBER} ${ECR_REPO}:\${BUILD_NUMBER}
                        docker tag ${APP_NAME}-lambda:\${BUILD_NUMBER} ${ECR_REPO}:latest

                        docker push ${ECR_REPO}:\${BUILD_NUMBER}
                        docker push ${ECR_REPO}:latest

                        aws lambda update-function-code \
                            --function-name contract-intel-process \
                            --image-uri ${ECR_REPO}:\${BUILD_NUMBER} \
                            --region ${AWS_REGION}
                    """
                }
            }
        }

        // Stage 6: Deploy backend to Render and run database migrations (main branch only)
        stage('Deploy') {
            when { expression { return true } }
            steps {
                withCredentials([string(credentialsId: 'render-deploy-hook', variable: 'RENDER_HOOK')]) {
                    sh 'curl -s -X POST ${RENDER_HOOK}'
                }
                withCredentials([string(credentialsId: 'prod-database-url', variable: 'DATABASE_URL')]) {
                    sh '''
                        docker run --rm \
                            -e DATABASE_URL=$(echo ${DATABASE_URL} | sed 's|postgresql://|postgresql+asyncpg://|') \
                            contract-intel-backend:${BUILD_NUMBER} \
                            alembic upgrade head
                    '''
                }
            }
        }

        // Stage 7: Wait for Render to deploy, then run a health check against the production API
        stage('Smoke Test') {
            when { expression { return true } }
            steps {
                sleep 180
                sh 'chmod +x ./scripts/healthcheck.sh'
                sh 'TIMEOUT=30 API_URL=https://contract-intelligence-platform.onrender.com ./scripts/healthcheck.sh'
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
            sh 'docker container prune -f || true'
        }
    }
}

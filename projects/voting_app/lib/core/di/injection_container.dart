import 'package:get_it/get_it.dart';
import 'package:voting_app/features/auth/data/repositories/auth_repository.dart';
import 'package:voting_app/features/auth/data/services/auth_services.dart';
import 'package:voting_app/features/elections/data/services/election_services.dart';
import 'package:voting_app/features/elections/domain/repository/election_repository.dart';
import 'package:voting_app/features/elections/domain/repository/election_repository_impl.dart';
import 'package:voting_app/features/elections/presentation/bloc/election_bloc.dart';

import '../network/dio_client.dart';
import '../storage/token_storage.dart';

import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';

final sl = GetIt.instance;

Future<void> initDependencies() async {
  // Core
  sl.registerLazySingleton<TokenStorage>(() => TokenStorage());

  sl.registerLazySingleton<DioClient>(() => DioClient(sl<TokenStorage>()));

  // Auth
  sl.registerLazySingleton<AuthService>(() => AuthService(sl<DioClient>()));

  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(
      authService: sl<AuthService>(),
      tokenStorage: sl<TokenStorage>(),
    ),
  ); // Elections
  sl.registerLazySingleton<ElectionService>(
    () => ElectionService(sl<DioClient>()),
  );

  sl.registerLazySingleton<ElectionRepository>(
    () => ElectionRepositoryImpl(electionService: sl<ElectionService>()),
  );

  sl.registerFactory<ElectionBloc>(
    () => ElectionBloc(electionRepository: sl<ElectionRepository>()),
  );

  // BLoC
  sl.registerFactory<AuthBloc>(
    () => AuthBloc(authRepository: sl<AuthRepository>()),
  );
}
